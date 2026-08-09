import { defineConfig } from "vitest/config";

// Real Postgres (DATABASE_URL) + Redis (REDIS_URL) required — run with
// `yarn test:integration`, not part of the default `yarn test`.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
