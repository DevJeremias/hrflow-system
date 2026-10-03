#!/usr/bin/env bash
# Backup diário do MySQL do HRFlow: mysqldump consistente, validado, enviado ao S3 (us-east-2).
# Roda na máquina pelo timer hrflow-backup.timer. A máquina só tem s3:PutObject no prefixo do bucket.
# BACKUP_BUCKET vem de /opt/hrflow/deploy/backup.env (sem segredo).
set -euo pipefail
source "$(dirname "$(readlink -f "$0")")/lib.sh"

: "${BACKUP_BUCKET:?defina BACKUP_BUCKET (veja backup.env)}"
PREFIXO="${BACKUP_PREFIX:-mysql}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-us-east-2}"

arquivo="$(mktemp /var/tmp/hrflow-dump.XXXXXX.sql.gz)"
trap 'rm -f "$arquivo"' EXIT

dump_para "$arquivo"

objeto="s3://${BACKUP_BUCKET}/${PREFIXO}/hrflow-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
aws s3 cp --only-show-errors "$arquivo" "$objeto"
echo "backup enviado: ${objeto} ($(stat -c %s "$arquivo") bytes)"
