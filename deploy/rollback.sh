#!/usr/bin/env bash
# Volta a versão em execução para <sha> (padrão: a anterior, em state/previous-sha), sem compilar e sem baixar
# nada quando a imagem ainda está na máquina (as 4 últimas ficam). Não mexe no banco.
# Uso: /opt/hrflow/deploy/rollback.sh [sha de 40 caracteres]
# As migrações só acrescentam (não há "down"): a versão anterior roda sobre o esquema novo. Se o esquema é que
# precisa voltar, restaure o dump state/dumps/pre-<sha>-*.sql.gz (runbook, "Restaurar").
set -euo pipefail
source "$(dirname "$(readlink -f "$0")")/lib.sh"

alvo="${1:-$(cat "$ESTADO_DIR/previous-sha" 2>/dev/null || true)}"
sha_valido "$alvo" || { echo "uso: rollback.sh <sha de 40 caracteres> (sem previous-sha para usar de padrão)" >&2; exit 2; }
travar

atual="$(cat "$ESTADO_DIR/current-sha" 2>/dev/null || true)"
log "rollback de ${atual:-?} para ${alvo}"

export IMAGE_TAG="$alvo"
for imagem in hrflow-api hrflow-web; do
  docker image inspect "$PREFIXO_IMAGENS/$imagem:$alvo" >/dev/null 2>&1 || { compose pull --quiet api web; break; }
done

printf 'IMAGE_TAG=%s\n' "$alvo" > "$ESTADO_DIR/release.env"
compose up -d --wait api web
printf '%s\n' "$alvo" > "$ESTADO_DIR/current-sha"
[ -n "$atual" ] && [ "$atual" != "$alvo" ] && printf '%s\n' "$atual" > "$ESTADO_DIR/rolled-back-from"
compose ps
log "em execução: ${alvo}"
