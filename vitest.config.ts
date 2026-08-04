import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    testTimeout: 30_000,
    // e2e.test.ts's beforeAll rebuilds dist/ (tsc); run test files sequentially
    // so no other file can read/copy dist/ mid-rebuild (see tests/get-version.test.ts).
    fileParallelism: false,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/cli/index.ts"],
      reporter: ["text", "text-summary"],
    },
  },
});
