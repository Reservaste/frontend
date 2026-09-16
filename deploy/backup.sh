#!/usr/bin/env bash
# Nightly logical backup of the Supabase database.
#
# The Supabase free tier does not take backups. These rows are other
# businesses' bookings and payments, so "free" without this would just be
# irresponsible. Runs from cron; see deploy/README.md.
set -euo pipefail

BACKUP_DIR=/srv/reservaste/backups
KEEP_DAYS=30
STAMP=$(date -u +%Y%m%d-%H%M%S)
OUT="$BACKUP_DIR/reservaste-$STAMP.sql.gz"

mkdir -p "$BACKUP_DIR"
# shellcheck disable=SC1091
source /srv/reservaste/frontend/deploy/.env.backup

# --no-owner/--no-acl: restoring into a fresh Supabase project should not
# depend on the role names of this one.
pg_dump "$SUPABASE_DB_URL" \
  --no-owner --no-acl \
  --schema=public --schema=storage \
  --exclude-table-data='storage.objects' \
  | gzip -9 > "$OUT.tmp"

# Only becomes a real backup once it is complete -- a truncated dump that
# looks like a backup is worse than a missing one.
mv "$OUT.tmp" "$OUT"

find "$BACKUP_DIR" -name 'reservaste-*.sql.gz' -mtime +$KEEP_DAYS -delete

SIZE=$(du -h "$OUT" | cut -f1)
echo "$(date -u +%FT%TZ) backup ok $OUT ($SIZE)"
