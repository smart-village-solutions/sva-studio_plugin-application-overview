import { defineConfig } from "vitest/config";
export default defineConfig({
  resolve: { dedupe: ["react", "react-dom", "@sva/plugin-sdk"] },
  test: {
    environment: "happy-dom",
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
    maxWorkers: 1,
    fileParallelism: false,
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "json-summary", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}"],
      thresholds: { lines: 85, statements: 85, functions: 85, branches: 85 },
    },
  },
});
