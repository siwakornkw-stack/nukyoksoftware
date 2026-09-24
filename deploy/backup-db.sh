#!/usr/bin/env bash
# Nightly PostgreSQL backup for dhevakij (run from the ubuntu user's crontab).
#   30 2 * * * /home/ubuntu/dhevakij/deploy/backup-db.sh >> /home/ubuntu/backups/backup.log 2>&1
# Keeps KEEP_DAYS days of nightly dumps. Only files named dhevakij-nightly-* are
# rotated, so the manual pre-deploy backups in the same folder are left alone.
# Optional off-machine copy: set OFFSITE to an rclone remote path (e.g. "dhkcrypt:");
# nightly files older than OFFSITE_KEEP_DAYS are pruned there.
set -euo pipefail

APP_DIR="${APP_DIR:-/home/ubuntu/dhevakij}"
BACKUP_DIR="${BACKUP_DIR:-/home/ubuntu/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
OFFSITE="${OFFSITE:-}"
OFFSITE_KEEP_DAYS="${OFFSITE_KEEP_DAYS:-90}"
# cron's PATH is /usr/bin:/bin; rclone lives in ~/bin (no sudo on this box).
RCLONE="${RCLONE:-$(command -v rclone || echo "$HOME/bin/rclone")}"

log() { echo "$(date '+%F %T') $*"; }
envval() { grep -E "^$1=" "$APP_DIR/.env" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'"; }

# Tell the app how it went (POST /api/cron/ops): a failure is pushed to the LINE
# admins and the morning summary shows the last result. Never fails the backup.
report() { # ok(true|false) message [size] [offsite(true|false)]
  local secret base
  secret=$(envval CRON_SECRET || true)
  base="${REPORT_BASE:-$(envval CRON_BASE_URL || true)}"
  base="${base:-http://127.0.0.1:3002}"
  [ -n "$secret" ] || return 0
  curl -s -m 20 -o /dev/null -X POST "$base/api/cron/ops" \
    -H "Authorization: Bearer $secret" -H "Content-Type: application/json" \
    -d "{\"kind\":\"backup\",\"ok\":$1,\"message\":\"$2\",\"size\":${3:-0},\"offsite\":${4:-false}}" \
    || log "WARN: could not report to the app"
}
fail() { log "ERROR: $*"; report false "$*"; exit 1; }
trap 'fail "unexpected error at line $LINENO"' ERR

url=$(grep -E '^DATABASE_URL=' "$APP_DIR/.env" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
[ -n "$url" ] || fail "DATABASE_URL not found in $APP_DIR/.env"
url="${url%%\?*}" # pg_dump rejects the ?schema=public suffix

mkdir -p "$BACKUP_DIR"
out="$BACKUP_DIR/dhevakij-nightly-$(date +%Y%m%d-%H%M%S).sql.gz"
tmp="$out.part"

# pipefail makes a pg_dump failure fail the pipeline; write to .part first so a
# half-written dump never looks like a good backup.
if ! pg_dump --no-owner --no-privileges "$url" | gzip > "$tmp"; then
  rm -f "$tmp"
  fail "pg_dump failed"
fi
gzip -t "$tmp"
size=$(stat -c %s "$tmp" 2>/dev/null || wc -c < "$tmp")
if [ "$size" -lt 1024 ]; then
  rm -f "$tmp"
  fail "dump is only $size bytes, not keeping it"
fi
mv "$tmp" "$out"
log "OK $out ($size bytes)"

find "$BACKUP_DIR" -maxdepth 1 -name 'dhevakij-nightly-*.sql.gz' -mtime +"$KEEP_DAYS" -print -delete | sed "s/^/$(date '+%F %T') removed /"

if [ -n "$OFFSITE" ]; then
  "$RCLONE" copy "$out" "$OFFSITE" && log "copied to $OFFSITE" || fail "local backup OK but copy to $OFFSITE failed"
  "$RCLONE" delete "$OFFSITE" --min-age "${OFFSITE_KEEP_DAYS}d" --include 'dhevakij-nightly-*.sql.gz' \
    || log "WARN: offsite prune failed"
fi

report true "OK" "$size" "$([ -n "$OFFSITE" ] && echo true || echo false)"
