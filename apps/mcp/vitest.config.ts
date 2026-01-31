import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["test/**/*.test.ts"],
    // Setup file for database mocking
    setupFiles: ["./test/setup.ts"],
  },
});
