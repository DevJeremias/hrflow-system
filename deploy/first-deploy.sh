#!/usr/bin/env bash
# Primeira instalação numa máquina nova (depois de bootstrap-userdata.sh e de /opt/hrflow/deploy/.env no lugar).
# Não carrega fixtures: máquina nova com dado real não pode receber dado de teste (seed.sh é só para homologação).
# Uso: copie esta pasta (deploy/) para /opt/hrflow/deploy e rode como ec2-user: ./first-deploy.sh <sha da main>
set -euo pipefail
cd "$(dirname "$(readlink -f "$0")")"
sha="${1:?uso: first-deploy.sh <sha de 40 caracteres da main com imagens publicadas>}"
source ./lib.sh

[ -d "$REPO_DIR/.git" ] || git clone --quiet https://github.com/DevJeremias/hrflow-system.git "$REPO_DIR"
mkdir -p "$ESTADO_DIR"
printf 'IMAGE_TAG=%s\n' "$sha" > "$ESTADO_DIR/release.env"
chmod +x ./*.sh
./update.sh "$sha"
echo "agora, como root: sudo $DEPLOY_DIR/install-deploy.sh && sudo $DEPLOY_DIR/install-backup.sh <bucket>"
