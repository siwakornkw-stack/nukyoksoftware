#!/usr/bin/env bash
# Nightly PostgreSQL backup for dhevakij (run from the ubuntu user's crontab).
#   30 2 * * * /home/ubuntu/dhevakij/deploy/backup-db.sh >> /home/ubuntu/backups/backup.log 2>&1
# Keeps KEEP_DAYS days of nightly dumps. Only files named dhevakij-nightly-* are
# rotated, so the manual pre-deploy backups in the same folder are left alone.
# Optional off-machine copy: set OFFSITE to an rclone remote path (e.g. "gdrive:dhevakij-backups").
set -euo pipefail

APP_DIR="${APP_DIR:-/home/ubuntu/dhevakij}"
BACKUP_DIR="${BACKUP_DIR:-/home/ubuntu/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
OFFSITE="${OFFSITE:-}"

log() { echo "$(date '+%F %T') $*"; }

url=$(grep -E '^DATABASE_URL=' "$APP_DIR/.env" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
[ -n "$url" ] || { log "ERROR: DATABASE_URL not found in $APP_DIR/.env"; exit 1; }
url="${url%%\?*}" # pg_dump rejects the ?schema=public suffix

mkdir -p "$BACKUP_DIR"
out="$BACKUP_DIR/dhevakij-nightly-$(date +%Y%m%d-%H%M%S).sql.gz"
tmp="$out.part"

# pipefail makes a pg_dump failure fail the pipeline; write to .part first so a
# half-written dump never looks like a good backup.
if ! pg_dump --no-owner --no-privileges "$url" | gzip > "$tmp"; then
  rm -f "$tmp"
  log "ERROR: pg_dump failed"
  exit 1
fi
gzip -t "$tmp"
size=$(stat -c %s "$tmp" 2>/dev/null || wc -c < "$tmp")
if [ "$size" -lt 1024 ]; then
  rm -f "$tmp"
  log "ERROR: dump is only $size bytes, not keeping it"
  exit 1
fi
mv "$tmp" "$out"
log "OK $out ($size bytes)"

find "$BACKUP_DIR" -maxdepth 1 -name 'dhevakij-nightly-*.sql.gz' -mtime +"$KEEP_DAYS" -print -delete | sed "s/^/$(date '+%F %T') removed /"

if [ -n "$OFFSITE" ]; then
  rclone copy "$out" "$OFFSITE" && log "copied to $OFFSITE" || { log "ERROR: offsite copy failed"; exit 1; }
fi
