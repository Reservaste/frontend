import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Same "@/" alias as tsconfig, so a test can import a route handler
    // the way the app does instead of reaching for a relative path that
    // only exists in the test.
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    // Plain modules, plus the route handlers that are pure request ->
    // response with no database behind them (the activation hand-off is
    // the one that matters: its bug was invisible to both the backend
    // integration suite, which never sees a cookie, and to the UI).
    // Pages and database-backed server actions stay in the backend's
    // integration suite, against a real database, not mocked here.
    include: ["lib/**/*.test.ts", "app/activar/**/*.test.ts"],
  },
});
