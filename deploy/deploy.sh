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

  # CI gate: only deploy a commit whose GitHub Actions "build" check passed.
  # Pending → try again next minute. No check at all for 15 min (Actions off/down) → deploy anyway.
  RUNS=$(curl -fsS -m 10 -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/hassan-t8/snapgrab/commits/$REMOTE/check-runs?check_name=build" 2>/dev/null || true)
  CI=$(printf '%s' "$RUNS" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const x=(JSON.parse(s).check_runs||[])[0];console.log(!x?"none":x.status!=="completed"?"pending":x.conclusion)}catch{console.log("unknown")}})')
  WAIT="$APP/ci-wait"
  case "$CI" in
    success) rm -f "$WAIT" ;;
    pending)
      [ "$(cut -d' ' -f1 "$WAIT" 2>/dev/null)" = "$REMOTE" ] || { echo "$REMOTE $(date +%s)" > "$WAIT"; log "waiting for CI on ${REMOTE:0:7}"; }
      exit 0 ;;
    none|unknown)
      [ "$(cut -d' ' -f1 "$WAIT" 2>/dev/null)" = "$REMOTE" ] || { echo "$REMOTE $(date +%s)" > "$WAIT"; log "no CI result yet for ${REMOTE:0:7}"; exit 0; }
      (( $(date +%s) - $(cut -d' ' -f2 "$WAIT") > 900 )) || exit 0
      log "no CI result after 15 min — deploying ${REMOTE:0:7} without it"; rm -f "$WAIT" ;;
    *)
      log "CI ${CI} on ${REMOTE:0:7} — not deploying, still running ${CURRENT:0:7}"
      echo "$REMOTE" > "$APP/last-failed-sha"; rm -f "$WAIT"; exit 0 ;;
  esac
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
