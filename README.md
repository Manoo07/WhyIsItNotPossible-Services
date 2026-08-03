# WhyIsItNotPossible — Backend

Express API for the blog platform, split out of the original monorepo. Originally used Drizzle
ORM; this repo migrates the same schema and every route to **Prisma**.

## Setup

```bash
cp .env.example .env   # then fill in DATABASE_URL and SESSION_SECRET
pnpm install            # also runs `prisma generate` via postinstall
pnpm run prisma:push     # create the schema in your database (or use prisma:migrate)
```

## Develop

```bash
pnpm run dev
```

Requires `DATABASE_URL`, `SESSION_SECRET`, and `PORT` to be set (see `.env.example`).

## Build

```bash
pnpm run build   # esbuild bundle to dist/
pnpm run start    # run the built server
```

## Schema changes

Edit `prisma/schema.prisma`, then:

```bash
pnpm run prisma:migrate   # dev: create + apply a migration
# or
pnpm run prisma:push       # prototyping: push schema without a migration
```

## API contract

Request/response validation uses hand-copied Zod schemas in `src/lib/validation.ts`, originally
generated from an OpenAPI spec (`@workspace/api-zod` in the old monorepo) via
[orval](https://orval.dev). This repo is the source of truth for the API — if you evolve routes
here, keep the frontend's `packages/api-client-react` in sync manually (or regenerate it from a
fresh OpenAPI spec authored against these routes).
