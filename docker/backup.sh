#!/bin/bash
# Automated PostgreSQL backup with encryption and off-site storage
# Usage: ./backup.sh [--full]
# Schedule via cron:
#   0 * * * * /opt/everyskill/backup.sh >> /var/log/everyskill-backup.log 2>&1
#   0 2 * * * /opt/everyskill/backup.sh --full >> /var/log/everyskill-backup.log 2>&1

set -euo pipefail

# Configuration (override via environment)
BACKUP_DIR="${BACKUP_DIR:-/backups}"
CONTAINER_NAME="${CONTAINER_NAME:-everyskill-postgres}"
DB_USER="${DB_USER:-everyskill}"
DB_NAMES="${DB_NAMES:-everyskill everyskill_staging}"
RETENTION_DAYS="${RETENTION_DAYS:-90}"
PASSPHRASE_FILE="${PASSPHRASE_FILE:-/etc/everyskill/backup-passphrase}"
STORAGEBOX_USER="${STORAGEBOX_USER:-}"
STORAGEBOX_HOST="${STORAGEBOX_HOST:-}"
STORAGEBOX_PORT="${STORAGEBOX_PORT:-23}"

# Derived
DATE=$(date +%Y%m%d_%H%M%S)
TYPE="snapshot"
if [[ "${1:-}" == "--full" ]]; then
  TYPE="full"
fi

# Validate
if [[ ! -f "$PASSPHRASE_FILE" ]]; then
  echo "[ERROR] Passphrase file not found: $PASSPHRASE_FILE"
  exit 1
fi
mkdir -p "$BACKUP_DIR"

for DB_NAME in $DB_NAMES; do
  BACKUP_FILE="${DB_NAME}_${TYPE}_${DATE}.sql.gz.gpg"

  echo "[$(date)] Starting ${TYPE} backup of ${DB_NAME}..."

  # Dump, compress, encrypt in single pipeline (no unencrypted temp file)
  docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" "$DB_NAME" \
    | gzip \
    | gpg --batch --yes --symmetric --cipher-algo AES256 \
          --passphrase-file "$PASSPHRASE_FILE" \
    > "${BACKUP_DIR}/${BACKUP_FILE}"

  FILESIZE=$(du -h "${BACKUP_DIR}/${BACKUP_FILE}" | cut -f1)
  echo "[$(date)] Backup created: ${BACKUP_FILE} (${FILESIZE})"

  # Transfer to off-site storage (Hetzner Storage Box)
  if [[ -n "$STORAGEBOX_USER" && -n "$STORAGEBOX_HOST" ]]; then
    echo "[$(date)] Transferring to off-site storage..."
    rsync -az --port="$STORAGEBOX_PORT" \
      "${BACKUP_DIR}/${BACKUP_FILE}" \
      "${STORAGEBOX_USER}@${STORAGEBOX_HOST}:backups/"
    echo "[$(date)] Off-site transfer complete"
  else
    echo "[$(date)] WARN: No storage box configured, skipping off-site transfer"
  fi
done

# Cleanup old local backups
DELETED=$(find "${BACKUP_DIR}" -name "*_${TYPE}_*.sql.gz.gpg" -mtime +${RETENTION_DAYS} -delete -print | wc -l)
if [[ "$DELETED" -gt 0 ]]; then
  echo "[$(date)] Cleaned up ${DELETED} backups older than ${RETENTION_DAYS} days"
fi

echo "[$(date)] Backup complete"
