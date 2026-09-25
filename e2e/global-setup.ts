import { chromium, type FullConfig } from "@playwright/test";
import { STORAGE_STATE_PATH } from "./auth-state";
import { login, requireEnv } from "./helpers";

/**
 * Signs in once, as plain Node code -- not inside any `test()` -- and saves
 * the resulting session as `storageState` for every spec to reuse.
 *
 * Why here and not `login()` called from each spec, the way this suite used
 * to work: a `test()` body that calls `.fill(password)` puts the real
 * production password in the HTML report's own step title (happens on
 * passing runs too, not just failures) and, with tracing on, in
 * `trace.zip`'s DOM/ARIA snapshots and `error-context.md` on any later
 * failure -- both are uploaded as a CI artifact with 14 days of retention,
 * readable by anyone with read access to the repo, and GitHub's log
 * secret-redaction has no effect on files inside an artifact. Confirmed
 * empirically against Playwright 1.63 (security review, ADR-0039).
 *
 * `globalSetup` has no step/trace recording at all -- it runs outside the
 * test executor's zone, so the exact same `login()` call that would leak
 * the password from inside a spec never gets logged anywhere from here.
 * Every spec then authenticates via the saved `storageState`
 * (`playwright.config.ts`'s default `use.storageState`) and never touches
 * the real password again. `trace` is also off globally now (see the
 * config) -- the same mechanism was found to expose a team invitation's
 * one-time link (`team-and-roles.spec.ts`) if that test failed mid-flow.
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const email = requireEnv("QA_EMAIL");
  const password = requireEnv("QA_PASSWORD");
  const baseURL = config.projects[0]?.use.baseURL as string | undefined;

  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();

  await login(page, email, password);

  await context.storageState({ path: STORAGE_STATE_PATH });
  await browser.close();
}
