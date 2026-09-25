import { chromium, type FullConfig, type Page } from "@playwright/test";
import { STORAGE_STATE_PATH } from "./auth-state";
import {
  ORG_SLUG,
  getTestCustomerIds,
  currentMonth,
  lastDayOfMonthISO,
  listAnotadoNames,
  removeAttendeeFromOccurrence,
} from "./helpers";

const TEST_CUSTOMERS = ["Cliente Uno", "Cliente Dos", "Cliente Tres", "Cliente Cuatro"];

// How far forward the booking sweep looks (the payment sweep instead reads
// each test customer's *whole* history in one page, so it has no separate
// horizon to bound). Scaled down from `agenda-colors.spec.ts`'s own
// `MAX_WEEKS_FORWARD` for a one-shot, best-effort pass at the end of the
// whole run rather than something a single test waits on.
const WEEKS_AHEAD = 6;

/**
 * Best-effort, whole-suite-level safety net (ADR-0039 / security review) --
 * NOT the primary cleanup mechanism. Every spec still cleans up after
 * itself in its own `try`/`finally` first; this exists for the case that
 * primary cleanup can't cover: the process killed mid-test, a network
 * failure inside the cleanup step itself, a test that throws before its
 * `finally` even runs. A failure here is logged, never thrown -- the
 * suite's own pass/fail already happened by the time this runs, and a
 * teardown that crashes the whole job would hide that real result behind
 * a misleading red X.
 *
 * Reuses the `storageState` `global-setup.ts` already produced instead of
 * logging in again -- no second real-password login, same reasoning as
 * `global-setup.ts`'s own doc comment.
 */
export default async function globalTeardown(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL as string | undefined;
  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL, storageState: STORAGE_STATE_PATH });
  const page = await context.newPage();

  try {
    await sweepPayments(page);
    await sweepInvitations(page);
    await sweepBookings(page);
  } catch (error) {
    console.error("[global-teardown] sweep failed (best-effort, not fatal):", error);
  } finally {
    await browser.close();
  }
}

/**
 * Voids any live (non-`VOID`) payment of the four test customers whose
 * period starts *after* the current month -- never the current month, so
 * a real, pre-existing payment the org owner registered for themselves
 * (the current month is the only one this suite's tests never touch --
 * `findCustomerAndMonthWithNoPayments` only ever picks a future one) is
 * never at risk from this sweep.
 */
async function sweepPayments(page: Page): Promise<void> {
  const customerIds = await getTestCustomerIds(page, ORG_SLUG, TEST_CUSTOMERS);
  const currentMonthEnd = lastDayOfMonthISO(currentMonth());

  for (const [name, customerId] of customerIds) {
    await page.goto(`/org/${ORG_SLUG}/customers/${customerId}`);
    const rows = page.locator('[data-slot="data-list-row"]').filter({ hasText: "Pilates" });
    const count = await rows.count();
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const text = await row.innerText();
      if (/anulado/i.test(text)) continue;
      const period = text.match(/(\d{4}-\d{2}-\d{2}) → (\d{4}-\d{2}-\d{2})/);
      if (!period || period[1]! <= currentMonthEnd) continue; // not a future-month payment

      const anular = row.getByRole("button", { name: /anular/i });
      if ((await anular.count()) === 0) continue;
      await anular.click();
      const ok = await waitUntil(async () => /anulado/i.test(await row.innerText()));
      if (!ok) {
        console.error(`[global-teardown] no se pudo confirmar "Anulado" para ${name}, período ${period[0]}`);
      }
    }
  }
}

/** Revokes any still-open invitation this suite's own emails could have created. */
async function sweepInvitations(page: Page): Promise<void> {
  await page.goto(`/org/${ORG_SLUG}/team?historial=1`);
  // Exactly `team-and-roles.spec.ts`'s own pattern (`qa-e2e-<timestamp>@example.com`)
  // -- specific enough to never touch "Ana Instructora" or a real invitation.
  const rows = page.locator('[data-slot="data-list-row"]').filter({ hasText: /qa-e2e-\d+@example\.com/ });
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
    const row = rows.nth(i);
    const revoke = row.getByRole("button", { name: /revocar/i });
    if ((await revoke.count()) === 0) continue; // already redeemed/expired/revoked
    await revoke.click();
    await page.getByRole("button", { name: "Sí, revocar" }).click();
    const ok = await waitUntil(async () => (await row.count()) === 0);
    if (!ok) console.error("[global-teardown] no se pudo confirmar la revocación de una invitación de prueba");
  }
}

/**
 * Cancels any active booking of the four test customers on a future,
 * non-cancelled occurrence, walking the admin agenda forward week by week
 * (same "Siguiente" navigation `agenda-colors.spec.ts` uses, bounded to
 * `WEEKS_AHEAD` instead of its own `MAX_WEEKS_FORWARD` -- this runs once
 * for the whole suite, not per test, but still shouldn't scan the entire
 * 90-day rolling window on every run).
 */
async function sweepBookings(page: Page): Promise<void> {
  for (let week = 0; week <= WEEKS_AHEAD; week++) {
    await page.goto(`/org/${ORG_SLUG}/agenda`);
    for (let i = 0; i < week; i++) {
      await page.getByRole("button", { name: "Siguiente" }).click();
    }

    const blocks = page.locator(`a[href*="/org/${ORG_SLUG}/agenda/"]`);
    const count = await blocks.count();
    const hrefs: string[] = [];
    for (let i = 0; i < count; i++) {
      const cls = (await blocks.nth(i).getAttribute("class")) ?? "";
      if (cls.includes("opacity-60")) continue; // past or cancelled
      const href = await blocks.nth(i).getAttribute("href");
      if (href) hrefs.push(href);
    }

    for (const href of hrefs) {
      await page.goto(href);
      const names = await listAnotadoNames(page).catch(() => [] as string[]);
      for (const testName of TEST_CUSTOMERS) {
        if (names.some((n) => n.toUpperCase() === testName.toUpperCase())) {
          try {
            await removeAttendeeFromOccurrence(page, testName);
          } catch (error) {
            console.error(`[global-teardown] no se pudo quitar a ${testName} de ${href}:`, error);
          }
        }
      }
    }
  }
}

async function waitUntil(check: () => Promise<boolean>, timeoutMs = 15_000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await check().catch(() => false)) return true;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return false;
}
