#!/usr/bin/env bash
# One-time bootstrap for the first Let's Encrypt certificate. Run this once,
# by hand, on a fresh host before the very first `./deploy.sh` — after this,
# the `certbot` service in docker-compose.yml renews the cert on its own
# from here on. You shouldn't need to run this again unless the domain
# changes or deploy/certbot/ is deleted.
#
# Why this script exists: nginx.conf's 443 server block references a cert
# file that doesn't exist yet on a fresh host, so nginx refuses to even
# start — but certbot's webroot challenge needs nginx already running on
# port 80 to serve the validation token back to Let's Encrypt. That's a
# chicken-and-egg problem, solved here the standard way: stand up a
# throwaway self-signed cert just long enough for nginx to boot, then swap
# in the real one and reload.
#
# Usage (from this deploy/ folder):
#   ./init-certbot.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if ! command -v docker &>/dev/null; then
  echo "docker is not installed or not on PATH. Install Docker Engine first." >&2
  exit 1
fi

if ! command -v openssl &>/dev/null; then
  echo "openssl is not installed or not on PATH." >&2
  exit 1
fi

if [ ! -f .env ]; then
  echo ".env not found in $SCRIPT_DIR" >&2
  echo "Copy .env.example to .env and fill in real values first (including DOMAIN and CERTBOT_EMAIL)." >&2
  exit 1
fi

# shellcheck disable=SC1091
set -a; source .env; set +a

if [ -z "${DOMAIN:-}" ]; then
  echo "DOMAIN is not set in .env — add e.g. DOMAIN=whyisitnotpossible.com first." >&2
  exit 1
fi
if [ -z "${CERTBOT_EMAIL:-}" ]; then
  echo "CERTBOT_EMAIL is not set in .env — Let's Encrypt wants a contact address for renewal/expiry notices." >&2
  exit 1
fi

if grep -q "YOUR_DOMAIN" ../../whyisitnotpossible-ui/nginx.conf 2>/dev/null; then
  echo "nginx.conf still has the YOUR_DOMAIN placeholder — replace every occurrence with" >&2
  echo "$DOMAIN before running this (it's baked into the image at build time, not read from .env)." >&2
  exit 1
fi

CERT_DIR="certbot/conf/live/$DOMAIN"

if [ -f "$CERT_DIR/fullchain.pem" ]; then
  echo "A certificate already exists at $CERT_DIR — nothing to bootstrap."
  echo "If you actually need a fresh one (e.g. the domain changed), remove deploy/certbot/ first."
  exit 0
fi

echo "==> Creating a temporary self-signed cert so nginx can start"
mkdir -p "$CERT_DIR" certbot/www
openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
  -keyout "$CERT_DIR/privkey.pem" \
  -out "$CERT_DIR/fullchain.pem" \
  -subj "/CN=$DOMAIN" >/dev/null 2>&1

echo "==> Building and starting the full stack (nginx boots on the dummy cert)"
docker compose build
docker compose up -d

echo "==> Waiting for nginx to answer on port 80"
for _ in $(seq 1 15); do
  if curl -s -o /dev/null --max-time 2 "http://localhost/.well-known/acme-challenge/"; then
    break
  fi
  sleep 2
done

echo "==> Requesting the real certificate from Let's Encrypt"
# Clears the dummy cert's lineage so certbot treats this as a fresh issuance
# rather than tripping over files it didn't create itself.
rm -rf "certbot/conf/live/$DOMAIN" "certbot/conf/archive/$DOMAIN" "certbot/conf/renewal/$DOMAIN.conf"
docker compose run --rm --entrypoint certbot certbot certonly \
  --webroot -w /var/www/certbot \
  -d "$DOMAIN" -d "www.$DOMAIN" \
  --email "$CERTBOT_EMAIL" \
  --agree-tos --no-eff-email

echo "==> Reloading nginx with the real certificate"
docker compose exec web nginx -s reload

echo
echo "Done. https://$DOMAIN should now be serving a real Let's Encrypt certificate."
echo "The 'certbot' service in docker-compose.yml keeps it renewed automatically from here on —"
echo "no need to run this script again unless the domain changes."
