# Deploying to a single EC2 instance

Everything runs as Docker containers on one host: Nginx (terminates HTTPS on
443, serves the built frontend, reverse-proxies `/api`), a `certbot`
container that keeps the TLS cert renewed, the API server, the notification
worker, and Redis. The database itself is external (not a container this
compose file manages) — see `DATABASE_URL` in step 3.

## 1. Point the domain at the instance

Before anything else: in your DNS provider, add an **A record** for the
domain (or subdomain, e.g. `www` or the bare apex) pointing at the
instance's public IP — ideally an [Elastic
IP](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/elastic-ip-addresses-eip.html)
so it doesn't change if the instance is ever stopped/started.

```
Type: A
Name: @  (or whatever subdomain you're using)
Value: <instance's Elastic IP>
```

DNS propagation can take a few minutes to a few hours. Confirm it's resolved
before continuing (`dig +short yourdomain.com` should print the IP) —
certbot's domain validation will just fail with a confusing error if it
hasn't propagated yet.

## 2. One-time instance setup (Amazon Linux 2023 / Ubuntu)

```bash
# Docker + compose plugin
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"
newgrp docker   # or log out/in so the group membership takes effect

# Both app repos, side by side (same layout this was developed in).
# This deploy/ folder currently lives inside whyisitnotpossible-services
# (temporary, until it's split into its own repo) — cloning that repo
# brings it along, no separate clone/scp needed.
git clone <whyisitnotpossible-services-url> whyisitnotpossible-services
git clone <whyisitnotpossible-ui-url> whyisitnotpossible-ui
cd whyisitnotpossible-services/deploy
```

Security group: allow inbound TCP **80 and 443** from `0.0.0.0/0` (80 is
still needed — certbot's renewal challenge and the plain-HTTP→HTTPS redirect
both use it), and 22 for SSH from your IP. Nothing else needs to be open —
Redis/the API only listen on the internal Docker network, not the host. If
the database is on a provider that restricts inbound connections by IP
(RDS security groups, Neon/Supabase IP allowlists), make sure it allows
this instance's IP separately — that's on the database provider's side,
not this security group.

## 3. Configure

```bash
# Already here from step 2's cd — if not: cd whyisitnotpossible-services/deploy
cp .env.example .env
```

Fill in `.env`:
- `DOMAIN` — the domain from step 1, no `https://` prefix (e.g.
  `whyisitnotpossible.com`).
- `CERTBOT_EMAIL` — a real address; Let's Encrypt uses it for
  expiry/renewal notices.
- `DATABASE_URL` — the existing database's connection string (see the
  comment in `.env.example`). Confirm it's actually reachable from this
  instance before continuing — a database that only allows connections
  from your laptop/dev environment won't be reachable from EC2.
- `SESSION_SECRET` — `openssl rand -base64 32`.
- `COOKIE_SECURE=true` — this deployment is HTTPS-only, so this should
  stay `true` (see the comment in `.env.example`).
- `AWS_*` — S3 bucket for image uploads.
- `SMTP_*` / `EMAIL_FROM` — for registration OTP / password reset / follow
  notification emails.
- `FRONTEND_URL` / `CORS_ALLOWED_ORIGINS` — set both to `https://<your domain>`
  (no trailing slash). These have to match what's actually in the browser's
  address bar, or cookie-carrying requests get rejected by CORS and
  notification-email/sitemap links point at the wrong place.

Then edit **`whyisitnotpossible-ui/nginx.conf`** directly: replace every
occurrence of `YOUR_DOMAIN` with your real domain. Nginx config can't read
`.env`, so this has to be a real text edit, not an environment variable —
it's baked into the image the next time it's built.

## 4. First-time HTTPS bootstrap (once per host)

```bash
./init-certbot.sh
```

This is a one-time chicken-and-egg fix: nginx won't start without a cert
file already on disk, but Let's Encrypt's validation needs nginx already
running to serve the challenge. The script stands up a throwaway
self-signed cert just long enough for nginx to boot, requests the real
certificate from Let's Encrypt, then reloads nginx with it. It also brings
up the full stack as a side effect (it runs `docker compose build && up -d`
internally), so after it finishes you should already have a working site at
`https://<your domain>`.

You should only need to run this once per host — the `certbot` service in
`docker-compose.yml` renews the cert automatically (checks twice a day,
renews when Let's Encrypt says it's within its ~30-day renewal window) from
here on.

## 5. Deploy (and every deploy after this)

```bash
./deploy.sh
```

This builds the images, brings up Redis, runs `prisma migrate deploy` once
against `DATABASE_URL`, then starts the API, worker, Nginx, and the certbot
renewal loop. First run also creates the Redis data volume. Re-running it
after a `git pull` in either app repo picks up and redeploys the new code
(rebuilds only what changed).

If the database doesn't already have the baseline taxonomy/static-page
content, run the seed scripts from `whyisitnotpossible-services/prisma/`
(`seed-taxonomy.mjs` for categories/tags, `seed-static-pages.mjs` for
About/Contact/Privacy/Terms) against it — the `api` container already has
`DATABASE_URL` in its environment, so:
`docker compose exec api node prisma/seed-taxonomy.mjs`.

## 6. Verify

- `https://<your domain>` loads the site, and the browser shows a valid
  padlock (no cert warning).
- `http://<your domain>` redirects to the `https://` version.
- `docker compose ps` shows `certbot` as `Up` (it should just be sitting in
  its renewal-check loop, not restarting).
- Try logging in — this is the first real test that `COOKIE_SECURE=true` +
  matching `FRONTEND_URL`/`CORS_ALLOWED_ORIGINS` are actually correct; a
  mismatch here is the classic "login looks like it works (200) but never
  actually persists" symptom.

## Useful commands

```bash
docker compose ps                    # what's running / healthy
docker compose logs -f api           # tail one service's logs
docker compose logs -f certbot       # confirm renewal checks are happening
docker compose restart api worker    # restart just the app, leave db/redis alone
docker compose down                  # stop everything (data volumes persist)
docker compose down -v               # stop AND wipe redis data — careful (the database is external and unaffected)
```

To force a renewal manually (e.g. to sanity-check the pipeline works, well
before the cert is actually close to expiring):

```bash
docker compose run --rm --entrypoint certbot certbot renew --webroot -w /var/www/certbot --force-renewal
docker compose exec web nginx -s reload
```

If you're testing this whole flow and want to avoid Let's Encrypt's
production rate limits (5 duplicate certs per domain per week), add
`--staging` to the `certonly`/`renew` command — staging certs aren't
trusted by browsers, so only use it to confirm the process completes
without errors, then remove `deploy/certbot/` and run `./init-certbot.sh`
again for real.

## Sizing this was written against

A single `t4g.small` (2 vCPU / 2 GB RAM, ARM64/Graviton) EC2 instance with a
20–30 GB gp3 volume. No `schema.prisma` changes needed for Graviton: `docker
compose build` is meant to run directly on the instance (per the setup steps
above, not cross-compiled from a different machine), so Prisma's `generate`
step detects "native" as ARM64 Alpine automatically and fetches the right
query engine on its own. The `binaryTargets` array in `schema.prisma` only
matters if you ever build on one architecture and deploy to another (e.g. a
CI runner on x86 building images for this ARM64 box) — not this setup.
`t3.small`/`t3.medium` (x86) work the same way, no changes either way.
