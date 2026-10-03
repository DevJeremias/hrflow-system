#!/usr/bin/env bash
# Instala o timer de backup na máquina. Uso: sudo /opt/hrflow/deploy/install-backup.sh <bucket>
set -euo pipefail
BUCKET="${1:?uso: install-backup.sh <bucket>}"
cd "$(dirname "$(readlink -f "$0")")"

echo "BACKUP_BUCKET=${BUCKET}" > backup.env
chmod 644 backup.env
chmod +x backup.sh
install -m 644 hrflow-backup.service hrflow-backup.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now hrflow-backup.timer
systemctl list-timers hrflow-backup.timer --no-pager
