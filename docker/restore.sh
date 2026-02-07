#!/bin/bash
# Restore a PostgreSQL backup from encrypted file
# Usage: ./restore.sh <backup-file.sql.gz.gpg>
# WARNING: This will DROP and recreate the database!

set -euo pipefail

BACKUP_FILE="${1:-}"
CONTAINER_NAME="${CONTAINER_NAME:-everyskill-postgres}"
DB_USER="${DB_USER:-everyskill}"
DB_NAME="${DB_NAME:-everyskill}"
PASSPHRASE_FILE="${PASSPHRASE_FILE:-/etc/everyskill/backup-passphrase}"

if [[ -z "$BACKUP_FILE" ]]; then
  echo "Usage: $0 <backup-file.sql.gz.gpg>"
  echo "Available backups:"
  ls -lh /backups/everyskill_*.sql.gz.gpg 2>/dev/null || echo "  (none found in /backups/)"
  exit 1
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "[ERROR] Backup file not found: $BACKUP_FILE"
  exit 1
fi

if [[ ! -f "$PASSPHRASE_FILE" ]]; then
  echo "[ERROR] Passphrase file not found: $PASSPHRASE_FILE"
  exit 1
fi

echo "[WARNING] This will DROP and recreate database '${DB_NAME}'!"
echo "Backup file: ${BACKUP_FILE}"
read -p "Type 'RESTORE' to confirm: " CONFIRM
if [[ "$CONFIRM" != "RESTORE" ]]; then
  echo "Aborted."
  exit 1
fi

echo "[$(date)] Starting restore from ${BACKUP_FILE}..."

# Decrypt, decompress, restore
gpg --batch --yes --decrypt --passphrase-file "$PASSPHRASE_FILE" "$BACKUP_FILE" \
  | gunzip \
  | docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME"

echo "[$(date)] Restore complete"
