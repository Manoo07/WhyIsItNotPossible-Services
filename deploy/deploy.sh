#!/usr/bin/env bash
# Builds and (re)starts the full stack on this host: postgres, redis, a
# one-shot Prisma migration, the API, the notification worker, nginx
# (serving the built frontend, reverse-proxying /api, terminating TLS on
# 443), and the certbot renewal loop.
#
# First time on a fresh host with a real domain? Run ./init-certbot.sh once
# BEFORE this script — nginx won't start without a cert already on disk.
#
# Usage (from this deploy/ folder, or run via ./deploy.sh from anywhere):
#   ./deploy.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if ! command -v docker &>/dev/null; then
  echo "docker is not installed or not on PATH. Install Docker Engine first." >&2
  exit 1
fi

if ! docker compose version &>/dev/null; then
  echo "The 'docker compose' plugin isn't available. Install docker-compose-plugin." >&2
  exit 1
fi

if [ ! -f .env ]; then
  echo ".env not found in $SCRIPT_DIR" >&2
  echo "Copy .env.example to .env and fill in real values first:" >&2
  echo "  cp .env.example .env" >&2
  exit 1
fi

echo "==> Building images"
docker compose build

echo "==> Starting postgres + redis, running migrations, then starting api/worker/web"
docker compose up -d

echo "==> Waiting for the API to report healthy"
for _ in $(seq 1 30); do
  status="$(docker compose ps --format json api 2>/dev/null | grep -o '"Health":"[a-z]*"' | cut -d'"' -f4 || true)"
  if [ "$status" = "healthy" ]; then
    echo "API is healthy."
    break
  fi
  sleep 2
done

echo
echo "==> Status"
docker compose ps

echo
# shellcheck disable=SC1091
domain="$(set -a; source .env; set +a; echo "${DOMAIN:-}")"
if [ -n "$domain" ] && [ "$domain" != "change-me" ]; then
  echo "Site should be reachable at: https://$domain"
  echo "(First time on this host? Run ./init-certbot.sh once before this script — see deploy/README.md.)"
else
  echo "DOMAIN isn't set in .env yet, so this is still serving plain HTTP."
fi
echo "(Make sure the EC2 security group allows inbound TCP 80 AND 443 from 0.0.0.0/0.)"
echo "Double-check FRONTEND_URL / CORS_ALLOWED_ORIGINS in .env match that address, then re-run this script if you change them."
