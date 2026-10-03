#!/usr/bin/env bash
# Funções comuns dos scripts de deploy na máquina. Quem usa faz `source "$(dirname "$(readlink -f "$0")")/lib.sh"`.
# HRFLOW_HOME só muda fora da máquina (ensaio local); em produção vale /opt/hrflow.
# shellcheck disable=SC2034  # as variáveis são lidas pelos scripts que fazem source deste arquivo
RAIZ="${HRFLOW_HOME:-/opt/hrflow}"
DEPLOY_DIR="$RAIZ/deploy"
REPO_DIR="$RAIZ/repo"
ESTADO_DIR="$RAIZ/state"
URL_PUBLICA="${HRFLOW_PUBLIC_URL:-https://hrflow.calliari.dev}"

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

# O compose lê o segredo de .env e a versão em execução de state/release.env (IMAGE_TAG, escrito por update.sh
# e rollback.sh). Uma IMAGE_TAG já no ambiente vence os dois arquivos, e é assim que update.sh escolhe a versão nova.
compose() {
  docker compose --project-directory "$DEPLOY_DIR" --env-file "$DEPLOY_DIR/.env" --env-file "$ESTADO_DIR/release.env" "$@"
}

# Compila na máquina as imagens do commit $1, que update.sh já conferiu estar na main e com o CI verde (auto-deploy.sh).
# O clone em $REPO_DIR serve só de contexto de build: fica sempre num checkout destacado do SHA.
construir() {
  local sha="$1"
  git -C "$REPO_DIR" checkout --quiet --detach "$sha"
  IMAGE_TAG="$sha" compose build api web
}

sha_valido() { [[ "${1:-}" =~ ^[0-9a-f]{40}$ ]]; }

# Um deploy, um rollback ou um backup por vez. auto-deploy.sh já segura o lock e avisa por HRFLOW_LOCK_HELD.
travar() {
  [ "${HRFLOW_LOCK_HELD:-}" = 1 ] && return 0
  mkdir -p "$ESTADO_DIR"
  exec 9>"$ESTADO_DIR/deploy.lock"
  flock -n 9 || { log "outro deploy ou rollback está em andamento, nada feito" >&2; exit 75; }
}

# mysqldump consistente e validado (marcador final) em $1. A senha nunca sai do contêiner.
# --single-transaction copia o InnoDB sem travar a API; triggers e rotinas fazem parte do schema.
dump_para() {
  local arquivo="$1"
  compose exec -T mysql sh -c \
    'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump -uroot --single-transaction --routines --triggers --events --no-tablespaces --databases "$MYSQL_DATABASE"' \
    | gzip -9 > "$arquivo"
  # Dump truncado (mysqldump caiu no meio) não vale como backup: o fim do arquivo tem de ser o marcador de sucesso.
  gzip -t "$arquivo"
  zcat "$arquivo" | tail -n 3 | grep -q -- '-- Dump completed' || { log "dump incompleto: $arquivo" >&2; return 1; }
}
