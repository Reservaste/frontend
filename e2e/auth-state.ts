import path from "node:path";

/**
 * Where the authenticated session `global-setup.ts` produces lives.
 * `.auth/` is gitignored (`frontend/.gitignore`) and outside
 * `playwright-report/` on purpose -- it holds real, live Supabase session
 * cookies for the QA owner account, not test output.
 *
 * A tiny module of its own (not exported from `global-setup.ts` or
 * `playwright.config.ts` directly) so the path has exactly one definition
 * that `playwright.config.ts` (default `use.storageState`), `global-setup.ts`
 * (where it's written) and `global-teardown.ts` (where it's read again for
 * the sweep) all import instead of each hardcoding it.
 *
 * `__dirname`, not `import.meta.url`: Playwright loads its config (and
 * whatever it imports) through its own CommonJS-flavoured TypeScript
 * loader, not native ESM -- `import.meta` there throws `ReferenceError:
 * exports is not defined`, confirmed running this for real.
 */
export const STORAGE_STATE_PATH = path.join(__dirname, ".auth", "storage-state.json");
