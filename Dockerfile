# syntax=docker/dockerfile:1

# --- deps: install once, cached as long as package.json/yarn.lock/schema don't change ---
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json yarn.lock ./
COPY prisma ./prisma
RUN yarn install --frozen-lockfile
RUN yarn prisma:generate

# --- build: bundle src/index.ts + src/worker.ts into dist/*.mjs via esbuild ---
FROM deps AS build
COPY . .
RUN yarn build

# --- runtime: node_modules kept whole (not pruned to prod-only) on purpose —
# build.mjs externalizes @prisma/client, @aws-sdk/*, and nodemailer rather
# than bundling them (they use native/dynamic requires esbuild can't inline),
# and `prisma migrate deploy` needs the prisma CLI (a devDependency) at
# startup. Pruning would mean hand-curating exactly which deps survive;
# keeping the full install is simpler and the size difference doesn't matter
# at this app's scale.
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/uploads ./uploads

EXPOSE 5000

# Overridden per-service in docker-compose.yml (api runs dist/index.mjs,
# worker runs dist/worker.mjs, migrate runs `prisma migrate deploy`) — this
# is just the default if the image is run standalone.
CMD ["node", "--enable-source-maps", "dist/index.mjs"]
