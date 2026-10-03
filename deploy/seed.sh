#!/usr/bin/env bash
# Carrega as fixtures sintéticas (duas empresas fictícias). SÓ para homologação: nunca em máquina com dado real.
# Passo separado porque a API roda com NODE_ENV=production e as fixtures recusam esse modo. Idempotente.
# Usa HRFLOW_SEED_PASSWORD do .env.
set -euo pipefail
source "$(dirname "$(readlink -f "$0")")/lib.sh"
set -a; . "$DEPLOY_DIR/.env"; set +a
compose up -d --wait mysql
compose run --rm --no-deps -e NODE_ENV=development -e HRFLOW_SEED_PASSWORD api node /app/scripts/db.mjs seed
