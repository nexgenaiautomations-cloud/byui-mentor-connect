import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.{ts,tsx}", "tests/unit/**/*.test.{ts,tsx}"],
    exclude: ["tests/e2e/**", "node_modules", ".next"],
    setupFiles: ["./tests/unit/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      all: true,
      // Pure-logic files. Server actions / session helpers / Drizzle schema
      // need integration-style coverage (mocked auth + DB) and are excluded
      // here so unit-test coverage is meaningful instead of inflated.
      include: [
        "src/lib/careers.ts",
        "src/lib/possible-actions.ts",
        "src/lib/safe-user.ts",
        "src/lib/rate-limit.ts",
      ],
      exclude: ["**/*.test.*", "**/*.d.ts"],
      thresholds: {
        lines: 95,
        functions: 95,
        statements: 95,
        branches: 80,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
