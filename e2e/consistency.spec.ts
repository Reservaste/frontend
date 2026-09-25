import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { ANONYMOUS_STORAGE_STATE, ORG_SLUG } from "./helpers";

/**
 * ADR-0039: no reference screenshots, no pixel-diff. UX/UI consistency is
 * checked with rules that are automatable and don't need a human to
 * approve every intentional visual change:
 *
 *  - `axe-core` on every key screen (contrast, labels, landmarks, etc).
 *  - No horizontal scroll at 390px (the narrowest phone this product
 *    still has to work on).
 *  - Every "empty list" message goes through the shared `EmptyState`
 *    component (`data-slot="empty-state"`), never a hand-rolled sentence.
 */
const SCREENS: { name: string; path: string; auth: boolean }[] = [
  { name: "Calendario público", path: `/${ORG_SLUG}`, auth: false },
  { name: "Login", path: "/login", auth: false },
  { name: "Agenda admin", path: `/org/${ORG_SLUG}/agenda`, auth: true },
  { name: "Pagos", path: `/org/${ORG_SLUG}/payments`, auth: true },
  { name: "Equipo", path: `/org/${ORG_SLUG}/team`, auth: true },
  { name: "Auditoría", path: `/org/${ORG_SLUG}/settings/registro`, auth: true },
];

/**
 * Threshold: fail on `serious`/`critical` only, not `moderate`/`minor`.
 * This is a post-deploy smoke test, not a merge gate (ADR-0039) -- the
 * lower-impact rules (e.g. redundant landmark text, non-unique `id`s in a
 * component library with generated ids) are real findings worth tracking,
 * but noisy enough on a live, evolving product to bury the ones that
 * actually block a real user (missing labels, insufficient contrast,
 * keyboard traps) if they gate every run.
 */
const BLOCKING_IMPACT = new Set(["serious", "critical"]);

async function checkA11y(page: Page, screenName: string) {
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter((v) => BLOCKING_IMPACT.has(v.impact ?? ""));
  const report = blocking
    .map((v) => `[${v.impact}] ${v.id} — ${v.help} (${v.nodes.length} nodo/s, ${v.helpUrl})`)
    .join("\n");
  expect(blocking, `${screenName}: violaciones de accesibilidad serias/críticas:\n${report}`).toEqual([]);
}

async function assertNoHorizontalScroll(page: Page, screenName: string) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(
    scrollWidth,
    `${screenName}: hay scroll horizontal a 390px (scrollWidth=${scrollWidth} > clientWidth=${clientWidth})`,
  ).toBeLessThanOrEqual(clientWidth);
}

/**
 * Not tied to any specific empty-state sentence (those change): flags any
 * element whose own text reads like an "empty list" message and is not
 * inside the real `EmptyState` component. A screen with real data (the
 * common case in `redentor`) simply has nothing to check here -- this is a
 * safety net for whichever screen happens to be empty on a given run, not
 * a requirement that a specific one is.
 */
async function assertEmptyMessagesUseEmptyState(page: Page, screenName: string) {
  // Precise on purpose (a false positive here breaks the suite on
  // perfectly normal content, confirmed running this against prod: a
  // bare "sin pagos" also matches `payments-list.tsx`'s "Sin pagos"
  // *status filter chip*, which is a label, not an empty-list message).
  // Every real `EmptyState` title in the app (grepped, not guessed) is a
  // multi-word sentence fragment -- "sin pagos **registrados**", "sin
  // créditos **de recupero**", "no se pud(o|ieron)" -- so the patterns
  // below require that shape rather than the bare noun.
  const suspects = page.locator(
    ":text-matches('todavía no |no hay |ningún \\\\w+ (coincide|cubre|tiene)|sin pagos registrados|sin créditos|sin horarios cargados|no se pud|nadie (anotó|reservó)', 'i')",
  );
  const count = await suspects.count();
  for (let i = 0; i < count; i++) {
    const el = suspects.nth(i);
    const text = (await el.textContent())?.trim() ?? "";
    // A badge/status chip (`data-slot="badge"`, `components/ui/badge.tsx`)
    // is a label, never this screen's empty-state message, regardless of
    // what it says -- excluded structurally, not by wording.
    const isBadge = await el.evaluate((node) => node.closest('[data-slot="badge"]') !== null);
    if (isBadge) continue;
    const wrapped = await el.evaluate((node) => node.closest('[data-slot="empty-state"]') !== null);
    expect(wrapped, `${screenName}: mensaje de "vacío" fuera de EmptyState: "${text}"`).toBe(true);
  }
}

for (const screen of SCREENS) {
  test.describe(screen.name, () => {
    // The default `storageState` (`playwright.config.ts`) is already the
    // QA owner's session; the two anonymous screens override it so they
    // see what a visitor with no account actually sees, not the owner's
    // view of their own organization.
    if (!screen.auth) {
      test.use({ storageState: ANONYMOUS_STORAGE_STATE });
    }

    test("accesibilidad: sin violaciones serias/críticas (axe)", async ({ page }) => {
      await page.goto(screen.path);
      await checkA11y(page, screen.name);
    });

    test("sin scroll horizontal a 390px de ancho", async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(screen.path);
      await assertNoHorizontalScroll(page, screen.name);
    });

    test("mensajes de lista vacía usan el patrón EmptyState real", async ({ page }) => {
      await page.goto(screen.path);
      await assertEmptyMessagesUseEmptyState(page, screen.name);
    });
  });
}
