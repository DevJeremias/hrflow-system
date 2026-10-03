#!/usr/bin/env bash
# Publica a versão <sha> na máquina: arquivos de deploy do commit, imagens do GHCR, dump, migrações e restart.
# A máquina não compila nada: as imagens vêm prontas do CI (.github/workflows/deploy.yml), com a tag igual ao SHA.
# Uso: /opt/hrflow/deploy/update.sh <sha de 40 caracteres>   (chamado pelo auto-deploy.sh, ou à mão em incidente)
# Falhou? ./rollback.sh volta à versão anterior (auto-deploy.sh já faz isso sozinho).
set -euo pipefail
source "$(dirname "$(readlink -f "$0")")/lib.sh"

sha="${1:-}"
sha_valido "$sha" || { echo "uso: update.sh <sha de 40 caracteres>" >&2; exit 2; }
travar

[ -s "$ESTADO_DIR/release.env" ] || { echo "sem $ESTADO_DIR/release.env: rode install-deploy.sh primeiro" >&2; exit 1; }
atual="$(cat "$ESTADO_DIR/current-sha" 2>/dev/null || true)"
log "publicando ${sha} (em execução: ${atual:-nenhuma})"

# Só entra em produção commit que está na main.
git -C "$REPO_DIR" fetch --quiet origin main
git -C "$REPO_DIR" merge-base --is-ancestor "$sha" origin/main \
  || { echo "o commit $sha não está na main" >&2; exit 1; }

# Os arquivos de deploy (compose, scripts, units) são os do commit. Nunca tocamos em .env nem em backup.env.
# Se o próprio update.sh ou o lib.sh mudaram, recomeça com a versão nova (HRFLOW_SINCRONIZADO evita o laço).
tmp="$(mktemp -d)"
git -C "$REPO_DIR" archive "$sha" deploy | tar -x -C "$tmp"
mudou=0
for arquivo in update.sh lib.sh; do cmp -s "$tmp/deploy/$arquivo" "$DEPLOY_DIR/$arquivo" || mudou=1; done
cp -a "$tmp/deploy/." "$DEPLOY_DIR/"
rm -rf "$tmp"
if [ "$mudou" = 1 ] && [ -z "${HRFLOW_SINCRONIZADO:-}" ]; then
  HRFLOW_SINCRONIZADO=1 HRFLOW_LOCK_HELD=1 exec "$DEPLOY_DIR/update.sh" "$sha"
fi

export IMAGE_TAG="$sha"
compose pull --quiet api web

compose up -d --wait mysql
# Dump antes de migrar: se uma migração sair errada, é daqui que se volta (runbook, "Restaurar").
mkdir -p "$ESTADO_DIR/dumps"
dump="$ESTADO_DIR/dumps/pre-${sha:0:12}-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
dump_para "$dump"
log "dump de segurança: $dump"
ls -1t "$ESTADO_DIR"/dumps/pre-*.sql.gz | tail -n +6 | xargs -r rm -f

compose run --rm --no-deps api node /app/scripts/db.mjs migrate

# A versão anterior fica registrada antes da troca, para o rollback achá-la mesmo se esta falhar no meio.
[ -n "$atual" ] && [ "$atual" != "$sha" ] && printf '%s\n' "$atual" > "$ESTADO_DIR/previous-sha"
printf 'IMAGE_TAG=%s\n' "$sha" > "$ESTADO_DIR/release.env"
compose up -d --wait --remove-orphans
printf '%s\n' "$sha" > "$ESTADO_DIR/current-sha"

# Guarda as 4 versões mais recentes de cada imagem (a atual, a anterior e as duas antes): o que sobra só ocupa disco.
for imagem in hrflow-api hrflow-web; do
  docker images --format '{{.Tag}}' "$PREFIXO_IMAGENS/$imagem" | grep -E '^[0-9a-f]{40}$' | tail -n +5 \
    | xargs -r -I{} docker rmi "$PREFIXO_IMAGENS/$imagem:{}" >/dev/null 2>&1 || true
done
docker image prune -f >/dev/null

compose ps
log "publicado ${sha}"
