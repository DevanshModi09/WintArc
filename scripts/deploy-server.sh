#!/usr/bin/env bash
# Puts the current code on the API server: builds the image here (the server
# is too small to build it), ships it over SSH, and swaps the container. If
# the new one doesn't come up healthy, the old image is started again.
#
#   scripts/deploy-server.sh
#
# Needs Docker running here and the server's key at ~/.ssh/wintarc-lightsail.pem.
# After a change to server/prisma/schema.prisma, run `npm run db:push` first.
set -euo pipefail

HOST="${WINTARC_HOST:-ubuntu@13.234.179.79}"
KEY="${WINTARC_KEY:-$HOME/.ssh/wintarc-lightsail.pem}"
ssh_server() { ssh -i "$KEY" -o BatchMode=yes -o ConnectTimeout=15 "$HOST" "$@"; }

cd "$(dirname "$0")/.."
set -a
. client/.env
set +a

echo "Building the image…"
docker build --platform linux/amd64 \
  --build-arg VITE_SUPABASE_URL="$VITE_SUPABASE_URL" \
  --build-arg VITE_SUPABASE_ANON_KEY="$VITE_SUPABASE_ANON_KEY" \
  --build-arg VITE_GOOGLE_CLIENT_ID="${VITE_GOOGLE_CLIENT_ID:-}" \
  -t wintarc:latest .

echo "Sending it to the server…"
# The image running now is kept as wintarc:previous, to go back to.
ssh_server 'docker tag wintarc:latest wintarc:previous'
docker save wintarc:latest | gzip | ssh_server 'gunzip | docker load'

echo "Swapping the container…"
ssh_server 'bash -s' <<'REMOTE'
set -euo pipefail
start() {
  docker rm -f app >/dev/null 2>&1 || true
  docker run -d --name app --network wintarc --restart unless-stopped --memory 300m \
    --env-file "$HOME/wintarc/server.env" "$1" >/dev/null
}
healthy() {
  for _ in $(seq 1 30); do
    [ "$(docker inspect app --format '{{.State.Health.Status}}' 2>/dev/null)" = healthy ] && return 0
    sleep 3
  done
  return 1
}
start wintarc:latest
if healthy; then
  echo "The new server is up and healthy."
  docker image prune -f >/dev/null
else
  echo "The new server didn't come up. Its last lines:" >&2
  docker logs --tail 30 app >&2 || true
  echo "Going back to the previous image." >&2
  start wintarc:previous
  exit 1
fi
REMOTE

curl -fsS -m 20 "https://13-234-179-79.sslip.io/api/health" && echo
