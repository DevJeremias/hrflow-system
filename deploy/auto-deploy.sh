#!/usr/bin/env bash
# Deploy por pull: o hrflow-deploy.timer chama este script a cada 2 minutos. Ele não recebe nada de fora (a máquina
# não aceita comando do GitHub): pergunta ao GitHub público qual é a cabeça da main e se o CI daquele commit passou.
# Só publica quando (1) o CI do commit terminou em success, (2) o SHA difere do que roda. Publica aquele SHA (compilando-o
# na máquina), não "a main de agora". Se a versão nova não responder em /api/ready
# com o próprio SHA em /api/health, volta à anterior e termina com erro (o workflow de publicação então falha).
# Opcional: um token só de leitura em /opt/hrflow/deploy/github.token, se o limite anônimo da API apertar.
set -euo pipefail
source "$(dirname "$(readlink -f "$0")")/lib.sh"

REPO_GITHUB="${HRFLOW_GITHUB_REPO:-DevJeremias/hrflow-system}"
PRAZO_SAUDE_S="${HRFLOW_PRAZO_SAUDE_S:-90}"

mkdir -p "$ESTADO_DIR"
exec 9>"$ESTADO_DIR/deploy.lock"
flock -n 9 || { log "deploy anterior ainda em andamento, nada feito"; exit 0; }
export HRFLOW_LOCK_HELD=1

# Registra o motivo de não publicar uma vez só por commit, para o journal não encher a cada 2 minutos.
avisar() {
  local msg="$1"
  [ "$(cat "$ESTADO_DIR/ultimo-aviso" 2>/dev/null || true)" = "$msg" ] && return 0
  printf '%s\n' "$msg" > "$ESTADO_DIR/ultimo-aviso"
  log "$msg"
}

cabeca="$(git -C "$REPO_DIR" ls-remote origin refs/heads/main | cut -f1)"
sha_valido "$cabeca" || { log "não consegui ler a cabeça da main (git ls-remote)" >&2; exit 1; }
atual="$(cat "$ESTADO_DIR/current-sha" 2>/dev/null || true)"
[ "$cabeca" = "$atual" ] && exit 0
[ "$cabeca" = "$(cat "$ESTADO_DIR/failed-sha" 2>/dev/null || true)" ] && exit 0

auth=()
[ -s "$DEPLOY_DIR/github.token" ] && auth=(-H "Authorization: Bearer $(cat "$DEPLOY_DIR/github.token")")
runs="$(curl -fsS --max-time 20 -H 'Accept: application/vnd.github+json' "${auth[@]}" \
  "https://api.github.com/repos/$REPO_GITHUB/actions/workflows/ci.yml/runs?head_sha=$cabeca&event=push&per_page=10")" \
  || { log "consulta ao GitHub falhou, tento no próximo ciclo" >&2; exit 0; }
conclusao="$(jq -r '[.workflow_runs[] | select(.head_branch == "main")] | first | if . == null then "sem-execucao" else (.conclusion // "em-andamento") end' <<<"$runs")"
case "$conclusao" in
  success) ;;
  sem-execucao|em-andamento) avisar "${cabeca:0:12}: CI ainda não terminou ($conclusao)"; exit 0 ;;
  *) avisar "${cabeca:0:12}: CI terminou em $conclusao, não publico"; exit 0 ;;
esac

# Responde com o SHA esperado e o banco pronto? Pergunta ao Caddy local pelo nome público (testa TLS e proxy).
saudavel() {
  local sha="$1" destino="${URL_PUBLICA#https://}" limite=$((SECONDS + PRAZO_SAUDE_S)) versao
  local host="${destino%%:*}" porta=443
  [[ "$destino" == *:* ]] && porta="${destino##*:}"
  local resolver=(--resolve "$host:$porta:127.0.0.1")
  while [ "$SECONDS" -lt "$limite" ]; do
    versao="$(curl -fsS --max-time 5 "${resolver[@]}" "$URL_PUBLICA/api/health" 2>/dev/null | jq -r '.versao // empty' 2>/dev/null || true)"
    if [ "$versao" = "$sha" ] && curl -fsS --max-time 5 -o /dev/null "${resolver[@]}" "$URL_PUBLICA/api/ready" 2>/dev/null; then
      return 0
    fi
    sleep 3
  done
  return 1
}

log "tentativa: ${atual:-nenhuma} -> $cabeca"
if "$DEPLOY_DIR/update.sh" "$cabeca" && saudavel "$cabeca"; then
  rm -f "$ESTADO_DIR/ultimo-aviso" "$ESTADO_DIR/failed-sha"
  log "publicado $cabeca"
  exit 0
fi

log "FALHA ao publicar $cabeca: voltando para ${atual:-?}" >&2
printf '%s\n' "$cabeca" > "$ESTADO_DIR/failed-sha"
if [ -n "$atual" ] && "$DEPLOY_DIR/rollback.sh" "$atual" && saudavel "$atual"; then
  log "rollback concluído: $atual em execução" >&2
else
  log "ROLLBACK FALHOU: intervenção manual (runbook, \"Incidente\")" >&2
fi
exit 1
