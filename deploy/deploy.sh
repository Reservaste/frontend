#!/usr/bin/env bash
# Deploy: pull, rebuild, swap. Run on the droplet as root.
#   /srv/reservaste/frontend/deploy/deploy.sh
set -euo pipefail

APP_DIR=/srv/reservaste/frontend
cd "$APP_DIR"

echo "==> Pulling"
git pull --ff-only origin main

echo "==> Building"
# The domain package is a private git dependency, so the build needs the
# deploy key -- forwarded through the agent, never copied into a layer.
eval "$(ssh-agent -s)" >/dev/null
trap 'ssh-agent -k >/dev/null 2>&1 || true' EXIT
ssh-add /root/.ssh/backend_deploy 2>/dev/null

cd "$APP_DIR/deploy"
docker compose build --ssh default app

echo "==> Restarting"
docker compose up -d

echo "==> Pruning old images"
docker image prune -f >/dev/null

echo "==> Waiting for health"
for _ in $(seq 1 30); do
  if [ "$(docker inspect -f '{{.State.Health.Status}}' deploy-app-1 2>/dev/null)" = "healthy" ]; then
    echo "OK: app healthy"
    exit 0
  fi
  sleep 5
done

echo "ERROR: app did not become healthy" >&2
docker compose logs --tail=50 app >&2
exit 1
