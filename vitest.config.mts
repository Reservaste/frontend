import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Only plain modules: pages and server actions are exercised by the
    // backend's integration suite against a real database, not mocked here.
    include: ["lib/**/*.test.ts"],
  },
});
