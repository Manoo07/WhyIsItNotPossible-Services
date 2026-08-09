import { defineConfig } from "vitest/config";

// Fast unit tests only — mocked DAOs, no real Postgres/Redis required.
// See vitest.integration.config.ts for tests that need live infra.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["src/**/*.integration.test.ts", "node_modules/**"],
  },
});
