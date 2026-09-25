import { test, expect, type Page } from "@playwright/test";
import {
  ORG_SLUG,
  ensureTestCustomers,
  getAnotadosCount,
  bookCustomerIntoOccurrence,
  removeAttendeeFromOccurrence,
  pickCustomerNotYetBooked,
} from "./helpers";

const TEST_CUSTOMERS = ["Cliente Uno", "Cliente Dos", "Cliente Tres", "Cliente Cuatro"];

type Tone = "success" | "warning" | "danger";

/**
 * Admin-agenda tone -> the class `TONE_BG` (schedule-calendar.tsx) paints
 * it with. `agenda-calendar.tsx` maps "available" to the calendar's own
 * `"primary"` tone (not `"success"`, which is reserved for the
 * public/customer calendars) -- `bg-primary-subtle` IS the "success" band
 * here.
 */
const TONE_CLASS: Record<Tone, string> = {
  success: "bg-primary-subtle",
  warning: "bg-warning-subtle",
  danger: "bg-destructive-subtle",
};

// SlotOccurrence materializes on a 90-day rolling window (ADR-0009); a week
// per "Siguiente" click covers it in ~13 clicks. A little headroom above
// that, not an unbounded loop, if the schedule of `redentor`
// (docs/decisions.md ADR-0039) ever changes.
const MAX_WEEKS_FORWARD = 14;

test.describe("Agenda admin: color por ocupación", () => {
  /**
   * ADR-0039 (decisión del usuario, tras encontrar en vivo que la
   * ocupación de referencia original ya no estaba): este test genera y
   * deshace su propia ocupación en dos turnos futuros reales de "Pilates"
   * (viernes 15:00/16:00, capacidad 5/3, el horario fijo que ya existía) --
   * nunca asume que una reserva fija ajena sigue viva. El dueño puede
   * seguir usando `redentor` en paralelo sin que esto dependa de nada que
   * él mantenga a mano.
   *
   * "success" no necesita reservar a nadie: es el estado ambiental por
   * defecto (0% de ocupación siempre pinta `success`) de cualquier turno
   * futuro sin tocar -- sólo warning/danger se construyen de verdad.
   */
  test("éxito/alerta/completo son estilos distinguibles en la grilla semanal", async ({ page }) => {
    await ensureTestCustomers(page, ORG_SLUG, TEST_CUSTOMERS);

    await page.goto(`/org/${ORG_SLUG}/agenda`);
    const byTime = await findNextOccurrencesByTime(page, ["15:00", "16:00"]);
    for (const time of ["15:00", "16:00"]) {
      expect(
        byTime.has(time),
        `No se encontró ningún turno futuro de Pilates a las ${time} -- ¿cambió el horario fijo de viernes ` +
          `que esta prueba reutiliza (docs/decisions.md, ADR-0039)?`,
      ).toBe(true);
    }

    // Found *before* engineering warning/danger, and explicitly not one of
    // the two occurrences about to be booked into (otherwise "success"
    // could coincidentally resolve to the very occurrence this test is
    // about to turn into "warning", which would still be logically
    // correct -- the colour is captured now, not read live later -- but
    // makes the 3-way comparison read like it compares an occurrence
    // against its own later self rather than three different turnos).
    await page.goto(`/org/${ORG_SLUG}/agenda`);
    const successFound = await scanForAllTones(page, ["success"], new Set(byTime.values()));
    const successHref = successFound.get("success")?.href;
    expect(
      successHref,
      "No se encontró ningún turno futuro en 0% de ocupación (tono 'success') para comparar -- inesperado, cualquier turno sin tocar debería estarlo.",
    ).toBeTruthy();
    const successColor = successFound.get("success")!.color;

    // Tracked as bookings actually happen (not just once a whole
    // occurrence's loop finishes) so a failure partway through still
    // leaves `finally` with an accurate list of what to undo.
    const booked: { href: string; customer: string }[] = [];

    try {
      const bands: { time: string; tone: "warning" | "danger" }[] = [
        { time: "15:00", tone: "warning" },
        { time: "16:00", tone: "danger" },
      ];

      for (const { time, tone } of bands) {
        const href = byTime.get(time)!;
        await page.goto(href);

        const capacity = Number(await page.getByLabel("Capacidad").inputValue());
        const target = bookingsNeededForBand(capacity, tone);
        expect(
          target,
          `El turno de las ${time} (capacidad ${capacity}) no puede llegar a la banda '${tone}' con un ` +
            `conteo entero de clientes -- elegí otra capacidad para ese horario (docs/decisions.md, ADR-0039).`,
        ).not.toBeNull();

        while ((await getAnotadosCount(page)) < target!) {
          const customer = await pickCustomerNotYetBooked(page, TEST_CUSTOMERS);
          await bookCustomerIntoOccurrence(page, customer);
          booked.push({ href, customer });
        }

        // Not just "booked N times" -- the occurrence actually has to
        // land exactly on `target`. Ambient interference (someone else
        // booking the same real turno while this runs) would otherwise
        // fail silently instead of failing loudly.
        const finalCount = await getAnotadosCount(page);
        expect(
          finalCount,
          `${time}: quedó en ${finalCount}/${capacity} en vez de ${target} -- ¿hay ocupación ajena a esta ` +
            `corrida en ese turno ahora mismo?`,
        ).toBe(target);
      }

      const warningColor = await colorOfOccurrence(page, byTime.get("15:00")!);
      const dangerColor = await colorOfOccurrence(page, byTime.get("16:00")!);

      const colors = { success: successColor, warning: warningColor, danger: dangerColor };
      const distinctColors = new Set(Object.values(colors));
      expect(
        distinctColors.size,
        `Las 3 bandas deberían pintar colores distintos y no lo hacen: ${JSON.stringify(colors)}`,
      ).toBe(3);
    } finally {
      // ADR-0039: never leave a real turno occupied by test customers --
      // undo every booking this test made, grouped by occurrence so each
      // is only navigated to once.
      const byHref = new Map<string, string[]>();
      for (const { href, customer } of booked) {
        const customers = byHref.get(href) ?? [];
        customers.push(customer);
        byHref.set(href, customers);
      }
      for (const [href, customers] of byHref) {
        await page.goto(href);
        for (const customer of customers) {
          await removeAttendeeFromOccurrence(page, customer);
        }
      }
    }
  });

  test("anotar y quitar a un cliente actualiza 'Anotados' de forma confiable", async ({ page }) => {
    // Reused, not recreated (ADR-0039): a no-op every time `redentor`
    // already has the four of them, a real fallback the one time it
    // doesn't. `pickCustomerNotYetBooked` below needs them to actually
    // exist as options in the "Anotar cliente" select.
    await ensureTestCustomers(page, ORG_SLUG, TEST_CUSTOMERS);

    await page.goto(`/org/${ORG_SLUG}/agenda`);
    // "success" here means "has room" (agenda-calendar.tsx) -- the only
    // band guaranteed to have a free seat to book into.
    const found = await scanForAllTones(page, ["success"]);
    const target = found.get("success");
    test.skip(
      !target,
      "No se encontró ningún turno futuro con cupo disponible (tono 'success') para probar alta/baja.",
    );
    await page.goto(target!.href);

    const customer = await pickCustomerNotYetBooked(page, TEST_CUSTOMERS);
    await bookCustomerIntoOccurrence(page, customer);
    try {
      await expect(page.locator("li", { hasText: customer })).toBeVisible();
    } finally {
      // ADR-0039: never leave a test reservation behind -- the standing
      // occupancy of this slot has to read the same after this test as it
      // did before it, for every run that follows.
      await removeAttendeeFromOccurrence(page, customer);
    }
  });
});

/** How many confirmed bookings land an occurrence of `capacity` in `band`, or `null` if none does. */
function bookingsNeededForBand(capacity: number, band: "warning" | "danger"): number | null {
  if (band === "danger") return capacity > 0 ? capacity : null;
  // "warning" (>= 80%, < 100%): the smallest integer count that clears
  // 80% without reaching 100% -- some capacities (e.g. 3: 0/33%/67%/100%)
  // have no such count, which is exactly the trap docs/decisions.md
  // (ADR-0039) already documents about picking test capacities.
  const n = Math.ceil(capacity * 0.8);
  return n > 0 && n < capacity ? n : null;
}

/** The rendered background colour of the occurrence block whose block links to `href`, on the current week view. */
async function colorOfOccurrence(page: Page, href: string): Promise<string> {
  await page.goto(`/org/${ORG_SLUG}/agenda`);
  const nextButton = page.getByRole("button", { name: "Siguiente" });
  for (let week = 0; week <= MAX_WEEKS_FORWARD; week++) {
    const block = page.locator(`a[href="${href}"]`).first();
    if ((await block.count()) > 0) {
      return block.evaluate((el) => getComputedStyle(el).backgroundColor);
    }
    if (week < MAX_WEEKS_FORWARD) await nextButton.click();
  }
  throw new Error(`No se volvió a encontrar el bloque de ${href} en ${MAX_WEEKS_FORWARD} semanas.`);
}

/**
 * Walks the admin agenda's week view forward, "Siguiente" click by click,
 * recording the href of the first non-past occurrence found at each of the
 * requested `times` ("HH:MM", the bold time on the block) -- never a
 * hardcoded date (ADR-0039): a fixed-schedule occurrence that already
 * ended renders in a flat, neutral style regardless of occupancy
 * (`schedule-calendar.tsx`, `event.past`), so only the *next future*
 * occurrence at that time is a valid target.
 */
async function findNextOccurrencesByTime(page: Page, times: string[]): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  const nextButton = page.getByRole("button", { name: "Siguiente" });

  for (let week = 0; week <= MAX_WEEKS_FORWARD; week++) {
    const blocks = page.locator(`a[href*="/org/${ORG_SLUG}/agenda/"]`);
    const count = await blocks.count();
    for (let i = 0; i < count; i++) {
      const block = blocks.nth(i);
      const cls = (await block.getAttribute("class")) ?? "";
      if (cls.includes("opacity-60")) continue; // past or cancelled

      const timeText = (await block.locator("span").first().innerText()).trim();
      if (found.has(timeText) || !times.includes(timeText)) continue;
      const href = await block.getAttribute("href");
      if (href) found.set(timeText, href);
    }

    if (found.size >= times.length) break;
    if (week < MAX_WEEKS_FORWARD) await nextButton.click();
  }

  return found;
}

/**
 * Walks the admin agenda's week view forward, "Siguiente" click by click,
 * recording the href + rendered colour of the first non-past occurrence
 * found in each requested tone -- never a hardcoded date (ADR-0039): a
 * fixed-schedule occurrence that already ended renders in a flat, neutral
 * style regardless of occupancy (`schedule-calendar.tsx`, `event.past`), so
 * only the *next future* occurrence of a band is a valid target.
 */
async function scanForAllTones(
  page: Page,
  only?: Tone[],
  excludeHrefs?: Set<string>,
): Promise<Map<Tone, { href: string; color: string }>> {
  const wanted = only ?? (Object.keys(TONE_CLASS) as Tone[]);
  const found = new Map<Tone, { href: string; color: string }>();
  const nextButton = page.getByRole("button", { name: "Siguiente" });

  for (let week = 0; week <= MAX_WEEKS_FORWARD; week++) {
    const blocks = page.locator(`a[href*="/org/${ORG_SLUG}/agenda/"]`);
    const count = await blocks.count();
    for (let i = 0; i < count; i++) {
      const block = blocks.nth(i);
      const cls = (await block.getAttribute("class")) ?? "";
      // Past or cancelled ("muted") occurrences render flat/desaturated
      // regardless of tone -- not a real answer to "what colour is this
      // occupancy band", so they're excluded outright, not just skipped.
      if (cls.includes("opacity-60")) continue;

      for (const tone of wanted) {
        if (found.has(tone) || !cls.includes(TONE_CLASS[tone])) continue;
        const href = await block.getAttribute("href");
        if (!href || excludeHrefs?.has(href)) continue;
        const color = await block.evaluate((el) => getComputedStyle(el).backgroundColor);
        found.set(tone, { href, color });
      }
    }

    if (found.size >= wanted.length) break;
    if (week < MAX_WEEKS_FORWARD) await nextButton.click();
  }

  return found;
}
