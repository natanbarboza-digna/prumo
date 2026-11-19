#!/bin/sh
# Database backup (plan 014): a compressed pg_dump in ./backups, keeping the
# 14 newest. Meant for the server's cron, e.g. every day at 3:00:
#   0 3 * * * cd /opt/prumo && ./deploy/backup.sh >> backups/backup.log 2>&1
set -eu
cd "$(dirname "$0")/.."

dir="${BACKUP_DIR:-./backups}"
mkdir -p "$dir"
file="$dir/prumo-$(date +%Y%m%d-%H%M%S).sql.gz"

docker compose -f docker-compose.prod.yml --env-file .env.production exec -T db \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --clean --if-exists' \
  | gzip > "$file"

# Keep the 14 newest backups.
ls -1t "$dir"/prumo-*.sql.gz | tail -n +15 | while read -r old; do rm -- "$old"; done

echo "Backup: $file"
