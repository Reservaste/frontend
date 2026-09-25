import { defineConfig, devices } from "@playwright/test";
import { STORAGE_STATE_PATH } from "./auth-state";

/**
 * Smoke E2E suite (ADR-0039).
 *
 * Runs after every frontend deploy, against the real production site --
 * never as a merge/CI gate (see `frontend/.github/workflows/ci.yml`,
 * `smoke-e2e`, `needs: deploy`). Real network + real Supabase + real
 * latency, so timeouts here are generous on purpose: this is not the fast
 * feedback loop `npm test` is.
 *
 * The suite operates the permanent `redentor` organization (see
 * `helpers.ts`), which is real, shared, mutable state -- not a throwaway
 * fixture. `fullyParallel: false` + a single worker is deliberate: two
 * specs racing to invite a teammate (2 seats total) or to pay the same
 * period would fail each other for reasons that have nothing to do with
 * what either of them is testing.
 *
 * Security review (ADR-0039): the real QA password is typed exactly once,
 * in `global-setup.ts`, outside the test runner entirely -- see that
 * file's doc comment for why. Every project/spec here authenticates via
 * the `storageState` it produces (default `use.storageState` below); no
 * spec calls `login()` with the real password again.
 */
export default defineConfig({
  testDir: "./",
  fullyParallel: false,
  workers: 1,
  // A real production run is expected to be flakier than a local one
  // (network hiccups, cold starts) -- one retry in CI absorbs that without
  // hiding a real, repeatable failure (which fails again on the retry too).
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["html", { open: "never" }]],
  globalSetup: "./global-setup.ts",
  globalTeardown: "./global-teardown.ts",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "https://161-35-63-60.sslip.io",
    actionTimeout: 20_000,
    navigationTimeout: 30_000,
    // Security review: tracing records a DOM/ARIA snapshot of every
    // action. With the login itself moved out of the test runner
    // (`global-setup.ts`) this no longer captures a password, but it was
    // also found to capture a team invitation's one-time link
    // (`team-and-roles.spec.ts`) on a mid-flow failure -- off entirely,
    // rather than re-litigating which specific action is "safe" to trace.
    trace: "off",
    // A password field renders as bullets on screen, so a screenshot
    // doesn't reproduce the trace/report leak above -- kept.
    screenshot: "only-on-failure",
    // Every spec starts already signed in as the QA owner, via the
    // session `global-setup.ts` saved -- a spec that needs to be
    // unauthenticated (the public calendar, the login screen itself)
    // overrides this with `test.use({ storageState: ANONYMOUS_STORAGE_STATE })`
    // (see `helpers.ts`).
    storageState: STORAGE_STATE_PATH,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
