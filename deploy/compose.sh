#!/usr/bin/env bash
# docker compose com a versão em execução e os segredos carregados: ./compose.sh ps, ./compose.sh logs -f api.
set -euo pipefail
source "$(dirname "$(readlink -f "$0")")/lib.sh"
compose "$@"
