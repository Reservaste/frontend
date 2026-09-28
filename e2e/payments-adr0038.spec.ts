import { test, expect } from "@playwright/test";
import {
  ORG_SLUG,
  getTestCustomerIds,
  ensureTestCustomers,
  findCustomerAndMonthWithNoPayments,
  findCustomerAndMonthAmong,
  findLivePaymentRow,
  inclusiveDays,
  round2,
  addDaysISO,
  lastDayOfMonthISO,
  overlaps,
  currentMonth,
  monthOffset,
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

  /**
   * Regression for the real production bug found and fixed 2026-09-28 (same
   * ADR-0038, see `docs/decisions.md`'s entry for that date): the day-based
   * proration above only makes sense when "Período desde/hasta" is edited
   * *within* the same month the plan already suggested. `RegisterPaymentForm`
   * also renders on the customer's ficha (`/org/[slug]/customers/[customerId]`,
   * no `?mes=`) where that suggested period is anchored to **today**, not to
   * whatever month the admin ends up typing. Editing the period there to a
   * month unrelated to today used to keep dividing by today's month length
   * and multiplying by the typed month's length -- `2500 / 30 × 31 = 2583.33`
   * for a $2.500 plan, real money charged wrong in production. The fix added
   * an `overlaps()` gate: no overlap between the edited period and the
   * plan's suggested one means no days-proration at all, and the amount
   * falls back to the plan's list price.
   *
   * This deliberately reuses `/customers/[customerId]` (not
   * `/payments/[customerId]?mes=`, already covered by the test above) --
   * that's the one screen where the bug was reachable, because it is the
   * one whose "full period" anchor is today instead of a month in the URL.
   */
  test("editar el período a un mes distinto (no sólo acortarlo) NO prorratea -- se mantiene el precio de lista del plan", async ({
    page,
  }) => {
    await ensureTestCustomers(page, ORG_SLUG, TEST_CUSTOMERS);
    const customerIds = await getTestCustomerIds(page, ORG_SLUG, TEST_CUSTOMERS);
    expect(customerIds.size).toBe(TEST_CUSTOMERS.length);

    // Lee el período que el plan sugiere HOY desde la ficha de cualquiera
    // de los cuatro clientes de prueba -- para un plan mensual
    // (CALENDAR_MONTH) `quote_service_plan_period()` nunca prorratea
    // (sólo lo hace un CALENDAR_PERIOD de más de un mes, ADR-0031), así
    // que el período y el precio sugeridos son los mismos sin importar
    // qué cliente esté eligiendo el plan. Se hace antes de buscar un
    // (cliente, mes) libre porque hace falta `fullDays` para descartar
    // meses "coincidentes" (ver más abajo).
    const anyCustomerId = customerIds.get(TEST_CUSTOMERS[0]!)!;
    await page.goto(`/org/${ORG_SLUG}/customers/${anyCustomerId}`);

    // IDs directos, no `getByLabel`: esta pantalla (a diferencia de
    // `/payments/[customerId]`) también tiene el form de "Crédito de
    // cortesía" (`MakeupCreditsPanel`), que repite el label "Servicio" en
    // su propio `<select>` -- `getByLabel("Servicio")` rompe en modo
    // estricto por las dos coincidencias. Los ids son los del
    // `RegisterPaymentForm` real (`customer-forms.tsx`), sin ambigüedad.
    const serviceText = await page
      .locator("#serviceId")
      .evaluate((el: HTMLSelectElement) => el.selectedOptions[0]?.textContent ?? "");
    const planText = await page
      .locator("#servicePlanId")
      .evaluate((el: HTMLSelectElement) => el.selectedOptions[0]?.textContent ?? "");
    expect(serviceText).toContain("Pilates");
    expect(planText).toContain("Mensual");

    const fullStart = await page.locator("#periodStart").inputValue();
    const fullEnd = await page.locator("#periodEnd").inputValue();
    const fullPrice = Number(await page.locator("#amount").inputValue());
    const fullDays = inclusiveDays(fullStart, fullEnd);
    expect(fullDays, `Período completo inválido leído del form: "${fullStart}" -> "${fullEnd}"`).not.toBeNull();
    expect(fullPrice).toBeGreaterThan(0);

    // Candidatos "bien alejados" de hoy (2 a 13 meses adelante -- a
    // propósito distinto del rango que el test de arriba ya recorre desde
    // el mes actual), EXCLUYENDO cualquier mes cuya cantidad de días
    // coincida con la del mes que el plan sugiere hoy (`fullDays`). Sin
    // esta exclusión, un mes de la misma longitud (p. ej. dos meses de 30
    // días) haría que la vieja división-y-multiplicación del bug diera,
    // por pura coincidencia aritmética, el mismo precio de lista -- y esta
    // prueba pasaría igual con el bug presente, sin probar nada.
    const base = currentMonth();
    const candidateMonths = Array.from({ length: 12 }, (_, i) => monthOffset(base, i + 2)).filter((m) => {
      const days = inclusiveDays(`${m}-01`, lastDayOfMonthISO(m));
      return days !== fullDays;
    });
    expect(
      candidateMonths.length,
      `Ningún mes entre 2 y 13 meses adelante de hoy tiene una cantidad de días distinta a la del mes que sugiere ` +
        `el plan (${fullDays} días) -- no se puede armar un caso de "mes distinto" inequívoco.`,
    ).toBeGreaterThan(0);

    const picked = await findCustomerAndMonthAmong(page, ORG_SLUG, customerIds, candidateMonths);
    test.skip(
      !picked,
      "Los 4 clientes de prueba ya tienen pagos en todos los meses candidatos -- no quedó ningún período libre y alejado de hoy para registrar sin colisionar.",
    );
    const { customerId, month } = picked!;

    // La ficha del cliente elegido, SIN `?mes=` -- la pantalla real donde
    // se reprodujo el bug (a diferencia de `/payments/[customerId]?mes=`,
    // acá el período completo del plan se resuelve anclado a hoy). Puede
    // ser un cliente distinto al usado para leer `fullStart/fullEnd`
    // arriba -- por lo ya explicado, el período y el precio que este
    // formulario sugiere no dependen de qué cliente está eligiendo.
    await page.goto(`/org/${ORG_SLUG}/customers/${customerId}`);

    // Mismo motivo que arriba: ids directos, no `getByLabel`, por el
    // "Servicio" duplicado de `MakeupCreditsPanel` en esta pantalla.
    const periodStartInput = page.locator("#periodStart");
    const periodEndInput = page.locator("#periodEnd");
    const amountInput = page.locator("#amount");

    const targetStart = `${month}-01`;
    const targetEnd = lastDayOfMonthISO(month);
    const targetDays = inclusiveDays(targetStart, targetEnd)!;

    // Confirma que el mes elegido de verdad no se solapa con el que el
    // plan sugirió hoy -- si se solapara, esto no probaría nada distinto
    // del caso de "acortar dentro del mismo mes" que ya cubre el test de
    // arriba.
    expect(
      overlaps(targetStart, targetEnd, fullStart, fullEnd),
      `El mes elegido (${month}, ${targetStart} → ${targetEnd}) se solapa con el período que sugirió el plan ` +
        `(${fullStart} → ${fullEnd}) -- no sirve como caso de "mes distinto". Reintentar con otro mes/cliente.`,
    ).toBe(false);
    // Repite, por las dudas, la garantía ya impuesta al construir
    // `candidateMonths`: si esto alguna vez diera igual, el resto de la
    // prueba sería una coincidencia, no una verificación.
    expect(targetDays).not.toBe(fullDays);

    // El valor que el bug de producción real habría mostrado: dividir por
    // los días del mes que el plan sugiere hoy (denominador viejo,
    // congelado en HOY) y multiplicar por los días del mes tipeado -- la
    // misma cuenta que dio $2.583,33 en vez de $2.500 el 2026-09-28.
    const buggyAmount = round2((fullPrice / fullDays!) * targetDays);

    // Mismo patrón de reintento que el test de arriba: la UI a veces no
    // repinta el monto derivado dentro de la ventana normal de
    // `expect(...).toBeVisible()`, y sólo reintentar el `.fill()` (no sólo
    // releer el DOM) lo destraba -- confirmado en producción.
    await expect(async () => {
      await periodStartInput.fill(targetStart);
      await periodEndInput.fill(targetEnd);
      await expect(page.getByText("Sugerido. Podés escribir otro monto.")).toBeVisible({ timeout: 3_000 });
      const amount = Number(await amountInput.inputValue());
      expect(
        amount,
        `El monto sugerido cambió a ${amount} al editar el período a un mes distinto al que sugirió el plan ` +
          `(${targetStart} → ${targetEnd}) -- tendría que quedarse en el precio de lista $${fullPrice}. ` +
          `Si dio ${buggyAmount}, es exactamente el bug de ADR-0038 (prorrateo cruzando meses sin relación) ` +
          `reproducido.`,
      ).toBeCloseTo(fullPrice, 2);
    }).toPass({ timeout: 25_000 });

    const periodLabel = `${targetStart} → ${targetEnd}`;

    // Round-trip completo, no sólo la lectura del input: confirma que lo
    // que realmente se manda a registrar (y queda guardado) es el precio
    // de lista, wrapped in try/finally como el resto de la suite
    // (ADR-0039) para no dejar un pago real vivo en `redentor`.
    await page.getByRole("button", { name: /^registrar pago$/i }).click();
    await expect(page.locator('[data-slot="form-success"]')).toContainText(/pago registrado/i, {
      timeout: 15_000,
    });

    try {
      const newRow = await findLivePaymentRow(page, "Pilates", periodLabel);
      expect(newRow, `No se encontró la fila del pago recién registrado (${periodLabel})`).not.toBeNull();
      await expect(newRow!).toBeVisible();
    } finally {
      // Ya estamos en la ficha del cliente -- "Anular" vive en la misma
      // pantalla, sin necesidad de navegar de nuevo (a diferencia del test
      // de arriba, que arranca en `/payments/[customerId]?mes=`).
      const paymentRow = await findLivePaymentRow(page, "Pilates", periodLabel);
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
