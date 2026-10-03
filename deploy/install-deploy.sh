#!/usr/bin/env bash
# Liga o deploy por pull na máquina: pasta de estado, versão em execução registrada e timer habilitado.
# Uso (uma vez, como root): sudo /opt/hrflow/deploy/install-deploy.sh [sha em execução]
# Sem argumento, a versão em execução é o HEAD de /opt/hrflow/repo: passe o SHA se o HEAD andou sem rebuild. Numa máquina que ainda roda imagens compiladas ali
# (hrflow-api:latest), elas ganham a tag do SHA para o rollback da primeira publicação ter para onde voltar.
set -euo pipefail
source "$(dirname "$(readlink -f "$0")")/lib.sh"

[ "$(id -u)" = 0 ] || { echo "rode com sudo" >&2; exit 1; }
sha="${1:-$(sudo -u ec2-user git -C "$REPO_DIR" rev-parse HEAD)}"
sha_valido "$sha" || { echo "SHA inválido: $sha" >&2; exit 1; }

install -d -o ec2-user -g ec2-user "$ESTADO_DIR"
if [ ! -s "$ESTADO_DIR/current-sha" ]; then
  for imagem in hrflow-api hrflow-web; do
    if ! docker image inspect "$PREFIXO_IMAGENS/$imagem:$sha" >/dev/null 2>&1 && docker image inspect "$imagem:latest" >/dev/null 2>&1; then
      docker tag "$imagem:latest" "$PREFIXO_IMAGENS/$imagem:$sha"
    fi
  done
  printf 'IMAGE_TAG=%s\n' "$sha" > "$ESTADO_DIR/release.env"
  printf '%s\n' "$sha" > "$ESTADO_DIR/current-sha"
  chown ec2-user:ec2-user "$ESTADO_DIR/release.env" "$ESTADO_DIR/current-sha"
fi

chmod +x "$DEPLOY_DIR"/*.sh
install -m 644 "$DEPLOY_DIR"/hrflow-deploy.service "$DEPLOY_DIR"/hrflow-deploy.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now hrflow-deploy.timer
echo "em execução: $(cat "$ESTADO_DIR/current-sha")"
systemctl list-timers hrflow-deploy.timer --no-pager
