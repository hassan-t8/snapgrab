#!/bin/bash
# Pull-based deploy for SnapGrab (runs as user "snapgrab" from cron every minute).
# Builds each new commit of main in its own release folder and switches to it
# only after a successful build + health check; otherwise the old release keeps running.
# Shares the VPS with the live WePower site, so builds run at the lowest CPU/IO priority.
# Usage: deploy.sh [--force]
set -euo pipefail
umask 022

APP=/var/www/snapgrab
REPO=https://github.com/hassan-t8/snapgrab.git
BRANCH=main
PORT=3200
KEEP=3
export PATH=/usr/local/bin:/usr/bin:/bin
export NODE_OPTIONS=--max-old-space-size=2048 NEXT_TELEMETRY_DISABLED=1
NICE="nice -n 19 ionice -c3"

log() { echo "[$(date -u +%FT%TZ)] $*"; }

exec 9>"$APP/deploy.lock"
flock -n 9 || exit 0

REMOTE=$(git ls-remote "$REPO" "refs/heads/$BRANCH" | cut -f1)
[ -n "$REMOTE" ] || { log "cannot reach GitHub"; exit 1; }
CURRENT=$(cat "$APP/current/.release-sha" 2>/dev/null || true)
FAILED=$(cat "$APP/last-failed-sha" 2>/dev/null || true)
if [ "${1:-}" != "--force" ]; then
  [ "$REMOTE" = "$CURRENT" ] && exit 0
  [ "$REMOTE" = "$FAILED" ] && exit 0
fi

REL="$APP/releases/$(date -u +%Y%m%d%H%M%S)-${REMOTE:0:7}"
log "deploying ${REMOTE:0:7} (was ${CURRENT:0:7})"
fail() { log "FAILED: $1 — still running ${CURRENT:0:7}"; echo "$REMOTE" > "$APP/last-failed-sha"; rm -rf "$REL"; exit 1; }

git clone -q --depth 1 --branch "$BRANCH" "$REPO" "$REL" || fail "git clone"
cd "$REL"
[ "$(git rev-parse HEAD)" = "$REMOTE" ] || fail "commit moved during clone"
echo "$REMOTE" > .release-sha
rm -rf mobile   # the Flutter app is not part of the website
ln -s "$APP/shared/.env" .env

$NICE npm ci --no-audit --no-fund --loglevel=error || fail "npm ci"
# SQLite file lives in shared/; without --accept-data-loss a destructive schema change fails the deploy
$NICE npx prisma db push --skip-generate || fail "prisma db push"
$NICE npm run build || fail "build"

PREV=$(readlink -f "$APP/current" 2>/dev/null || true)
switch_to() { ln -sfn "$1" "$APP/current.new" && mv -Tf "$APP/current.new" "$APP/current"; NODE_OPTIONS= pm2 startOrReload "$APP/ecosystem.config.cjs" --update-env >/dev/null; }
switch_to "$REL"

healthy=0
for _ in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://localhost:$PORT/" || true)
  case "$code" in 2??|3??) healthy=1; break ;; esac
  sleep 2
done

if [ "$healthy" = 1 ]; then
  pm2 save >/dev/null
  rm -f "$APP/last-failed-sha"
  log "live: ${REMOTE:0:7}"
  ls -1dt "$APP"/releases/*/ | tail -n +$((KEEP + 1)) | xargs -r rm -rf
else
  log "health check failed (last code: $code), rolling back"
  echo "$REMOTE" > "$APP/last-failed-sha"
  if [ -n "$PREV" ] && [ -d "$PREV" ] && [ "$PREV" != "$REL" ]; then switch_to "$PREV"; rm -rf "$REL"; fi
  exit 1
fi
