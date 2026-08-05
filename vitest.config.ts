import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    testTimeout: 30_000,
    // e2e.test.ts's beforeAll rebuilds dist/ (tsc); run test files sequentially
    // so no other file can read/copy dist/ mid-rebuild (see tests/get-version.test.ts).
    fileParallelism: false,
    // Use worker threads, not child processes: threads die with the vitest parent
    // process, so a harness/kill of the runner cannot leave orphaned pool processes
    // holding memory (the forks-pool leak that forced aborting full-suite runs).
    // This repo never uses process.chdir or native addons, so threads is safe here.
    pool: "threads",
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/cli/index.ts"],
      reporter: ["text", "text-summary"],
    },
  },
});
