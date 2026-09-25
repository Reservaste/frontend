import { test, expect } from "@playwright/test";
import {
  ORG_SLUG,
  getTestCustomerIds,
  ensureTestCustomers,
  findCustomerAndMonthWithNoPayments,
  findLivePaymentRow,
} from "./helpers";

const TEST_CUSTOMERS = ["Cliente Uno", "Cliente Dos", "Cliente Tres", "Cliente Cuatro"];

/**
 * ADR-0032: an OWNER-only, read-only log of who did what and when. This
 * spec is self-contained (own payment, own cleanup) rather than chaining
 * onto `payments-adr0038.spec.ts`'s: specs have to be able to run alone
 * (`npx playwright test audit-log.spec.ts`) without depending on another
 * file's leftover, un-voided state.
 */
test.describe("Registro de actividad", () => {
  test("una acción auditable (registrar un pago) aparece con actor y fecha correctos", async ({ page }) => {
    // Already signed in as the QA owner via the suite's default
    // `storageState` (`playwright.config.ts` / `global-setup.ts`).
    await ensureTestCustomers(page, ORG_SLUG, TEST_CUSTOMERS);
    const customerIds = await getTestCustomerIds(page, ORG_SLUG, TEST_CUSTOMERS);
    expect(customerIds.size).toBe(TEST_CUSTOMERS.length);

    const picked = await findCustomerAndMonthWithNoPayments(page, ORG_SLUG, customerIds);
    test.skip(
      !picked,
      "Los 4 clientes de prueba ya tienen pagos en los próximos 6 meses -- no quedó ningún período libre.",
    );
    const { customerId, customerName, month } = picked!;

    await page.goto(`/org/${ORG_SLUG}/payments/${customerId}?mes=${month}`);
    const periodStart = await page.getByLabel("Período desde").inputValue();
    const periodEnd = await page.getByLabel("Período hasta").inputValue();

    await page.getByRole("button", { name: /^registrar pago$/i }).click();
    await expect(page.locator('[data-slot="form-success"]')).toContainText(/pago registrado/i, {
      timeout: 15_000,
    });

    // The audit entry has to exist and be legible before voiding: void it
    // in `finally` regardless of what the assertions below find, so a
    // failed assertion here never leaves the test payment live.
    try {
      await page.goto(`/org/${ORG_SLUG}/settings/registro`);

      // Matched on all three at once (title + this customer + this exact
      // period), not `.first()` picked before checking them: this row has
      // to be *the* entry this test just created, not just the most
      // recent "Se registró un pago" of any customer/period.
      const entry = page
        .locator('[data-slot="data-list-row"]')
        .filter({ hasText: "Se registró un pago" })
        .filter({ hasText: customerName })
        .filter({ hasText: `${periodStart} → ${periodEnd}` })
        .first();
      await expect(entry).toBeVisible();

      // Actor: a real member's name, never "Sistema" (no actor) nor
      // "Soporte de Reservaste" (a platform actor) -- this action was
      // taken by the QA owner logged in above.
      const actorLine = entry.getByText(/^Por:/);
      await expect(actorLine).toBeVisible();
      const actorText = await actorLine.innerText();
      expect(actorText).not.toMatch(/Por:\s*Sistema\s*$/);
      expect(actorText).not.toMatch(/Soporte de Reservaste/);

      // Timestamp: "DD/MM/YYYY, HH:MM" per `settings/registro/page.tsx`'s
      // own `Intl.DateTimeFormat` (organization timezone, not the test
      // runner's -- never asserted against a computed "today" here to
      // avoid a false negative near a timezone's midnight boundary). The
      // customer name and exact period range matched just above already
      // tie this row uniquely to the payment this test just created. The
      // comma is real (`Intl` puts one between date and time for "es-UY"),
      // confirmed running this against prod -- optional here so a locale
      // rendering tweak upstream doesn't break this on the comma alone.
      await expect(entry).toContainText(/\d{2}\/\d{2}\/\d{4},?\s+\d{2}:\d{2}/);
    } finally {
      // Security review (ADR-0039): "clicked the button" isn't cleanup --
      // clicked-but-didn't-take is exactly the silent failure mode a
      // best-effort `finally` has to rule out. Verified below (the
      // `global-teardown.ts` sweep is the backstop for when even this
      // fails, e.g. the click itself times out).
      await page.goto(`/org/${ORG_SLUG}/customers/${customerId}`);
      // `findCustomerAndMonthWithNoPayments` is `VOID`-aware, so a repeat
      // run the same day can land on this exact same period again, next
      // to an already-voided row with identical text --
      // `findLivePaymentRow` (index-stable, not a `hasNotText: "Anulado"`
      // filter reused across the void itself) is what keeps this correct
      // both before and after clicking "Anular" (payments-adr0038.spec.ts
      // hit both failure modes for real).
      const paymentRow = await findLivePaymentRow(page, "Pilates", `${periodStart} → ${periodEnd}`);
      if (paymentRow) {
        const anular = paymentRow.getByRole("button", { name: /anular/i });
        if ((await anular.count()) > 0) {
          await anular.click();
          await expect(paymentRow.getByText(/anulado/i)).toBeVisible({ timeout: 15_000 });
        }
      }
    }
  });
});
