import { test, expect } from "@playwright/test";
import {
  ORG_SLUG,
  getTestCustomerIds,
  ensureTestCustomers,
  findCustomerAndMonthWithNoPayments,
  findLivePaymentRow,
  inclusiveDays,
  round2,
  addDaysISO,
} from "./helpers";

const TEST_CUSTOMERS = ["Cliente Uno", "Cliente Dos", "Cliente Tres", "Cliente Cuatro"];

/**
 * ADR-0038: editing "Período hasta" by hand re-suggests the amount,
 * prorated by days against the plan's own full period. This test picks a
 * (customer, month) pair with zero existing payments first -- proven, not
 * assumed -- exactly what the ADR asked QA to check before choosing dates,
 * so the registration never collides with the period `EXCLUDE` constraint.
 */
test.describe("Pagos: prorrateo por días al editar el período (ADR-0038)", () => {
  test("registrar, acortar el período recalcula el monto, y anular lo revierte", async ({ page }) => {
    // Already signed in as the QA owner via the suite's default
    // `storageState` (`playwright.config.ts` / `global-setup.ts`).

    // Reused, not recreated (ADR-0039): a no-op every time `redentor`
    // already has the four of them, a real fallback the one time it
    // doesn't.
    await ensureTestCustomers(page, ORG_SLUG, TEST_CUSTOMERS);
    const customerIds = await getTestCustomerIds(page, ORG_SLUG, TEST_CUSTOMERS);
    expect(customerIds.size).toBe(TEST_CUSTOMERS.length);

    const picked = await findCustomerAndMonthWithNoPayments(page, ORG_SLUG, customerIds);
    test.skip(
      !picked,
      "Los 4 clientes de prueba ya tienen pagos en los próximos 6 meses -- no quedó ningún período libre para registrar sin colisionar.",
    );
    const { customerId, month } = picked!;

    await page.goto(`/org/${ORG_SLUG}/payments/${customerId}?mes=${month}`);

    // Sanity: the only service/plan this dataset has (ADR-0039).
    const serviceText = await page
      .getByLabel("Servicio")
      .evaluate((el: HTMLSelectElement) => el.selectedOptions[0]?.textContent ?? "");
    const planText = await page
      .getByLabel("Plan")
      .evaluate((el: HTMLSelectElement) => el.selectedOptions[0]?.textContent ?? "");
    expect(serviceText).toContain("Pilates");
    expect(planText).toContain("Mensual");

    const periodStartInput = page.getByLabel("Período desde");
    const periodEndInput = page.getByLabel("Período hasta");
    const amountInput = page.getByLabel("Monto");

    const fullStart = await periodStartInput.inputValue();
    const fullEnd = await periodEndInput.inputValue();
    const fullPrice = Number(await amountInput.inputValue());
    const fullDays = inclusiveDays(fullStart, fullEnd);
    expect(fullDays, `Período completo inválido leído del form: "${fullStart}" -> "${fullEnd}"`).not.toBeNull();
    expect(fullPrice).toBeGreaterThan(0);

    // Edit only "Período hasta" -- "Período desde" stays the plan's own
    // suggestion, same as a front-desk correction would.
    const shortEnd = addDaysISO(fullStart, 9); // 10 inclusive days
    const editedDays = inclusiveDays(fullStart, shortEnd)!;
    const expectedAmount = round2((fullPrice / fullDays!) * editedDays);

    // Retries the `.fill()` itself, not just the assertion after it: a
    // real, intermittent race was observed running this against prod
    // twice today -- the input's own value visibly updated to `shortEnd`,
    // but the derived "Monto"/hint never re-rendered within the usual
    // `expect(...).toBeVisible()` auto-retry window, and simply waiting
    // longer never recovered it. Re-issuing the fill (not just re-reading
    // the DOM) is what actually clears it -- same principle as
    // `waitForAnotadosCount`'s `toPass()` loop in `helpers.ts`: don't
    // just wait for a real UI race, re-try the action that's supposed to
    // cause the change.
    await expect(async () => {
      await periodEndInput.fill(shortEnd);
      await expect(page.getByText("Sugerido. Podés escribir otro monto.")).toBeVisible({ timeout: 3_000 });
      const amount = Number(await amountInput.inputValue());
      expect(
        amount,
        `El monto no se recalculó a ${expectedAmount} (precio completo ${fullPrice} / ${fullDays} días * ${editedDays} días editados)`,
      ).toBeCloseTo(expectedAmount, 2);
    }).toPass({ timeout: 25_000 });

    const periodLabel = `${fullStart} → ${shortEnd}`;

    // Security review (ADR-0039): from the click that registers the real
    // payment through the void that undoes it, wrapped in `finally` --
    // same shape `audit-log.spec.ts` already uses. Without this, a slow
    // or failing assertion between "registered" and "voided" (the row
    // taking too long to appear, a locator mismatch) leaves a real,
    // non-VOID payment live in `redentor` with nothing left in the test to
    // clean it up. `global-teardown.ts`'s sweep is the second-line
    // backstop, not a substitute for this.
    await page.getByRole("button", { name: /^registrar pago$/i }).click();
    await expect(page.locator('[data-slot="form-success"]')).toContainText(/pago registrado/i, {
      timeout: 15_000,
    });

    try {
      // `findCustomerAndMonthWithNoPayments` is `VOID`-aware (it treats an
      // all-`VOID` month as free), which means a *repeat* run against the
      // same (customer, month) -- same day, same math -- lands on this
      // exact same 10-day `periodLabel` again, next to an already-`Anulado`
      // row that says the same thing. `findLivePaymentRow` (not a plain
      // `.filter({ hasText: ... })`) is what keeps this singular in that
      // case (confirmed hitting this for real: without it, two runs the
      // same day made this a strict-mode violation).
      const newRow = await findLivePaymentRow(page, "Pilates", periodLabel);
      expect(newRow, `No se encontró la fila del pago recién registrado (${periodLabel})`).not.toBeNull();
      await expect(newRow!).toBeVisible();
    } finally {
      // "Anular" only lives on the customer's full payment history, not
      // on this month-scoped screen.
      await page.goto(`/org/${ORG_SLUG}/customers/${customerId}`);
      const paymentRow = await findLivePaymentRow(page, "Pilates", periodLabel);
      if (paymentRow) {
        const anular = paymentRow.getByRole("button", { name: /anular/i });
        if ((await anular.count()) > 0) {
          await anular.click();
          // Verified, not just clicked: "clicked the button" isn't
          // cleanup if the click didn't actually take. `paymentRow` stays
          // valid across this state change -- see `findLivePaymentRow`'s
          // doc comment for why that matters here.
          await expect(paymentRow.getByText(/anulado/i)).toBeVisible({ timeout: 15_000 });
        }
      }
    }
  });
});
