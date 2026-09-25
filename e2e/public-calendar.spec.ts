import { test, expect } from "@playwright/test";
import { ANONYMOUS_STORAGE_STATE, ORG_SLUG } from "./helpers";

/**
 * The public calendar lives at `/[organizationSlug]` (e.g. `/redentor`) --
 * NOT `/org/[slug]`, which is the authenticated admin panel. No login here
 * on purpose: this is what any visitor with the link sees -- overrides the
 * suite's default authenticated `storageState` (`playwright.config.ts`)
 * with a blank one, or every assertion here about what an anonymous
 * visitor sees ("Ingresar", not "Mi agenda") would be testing the QA
 * owner's own view instead.
 */
test.describe("Calendario público (anónimo)", () => {
  test.use({ storageState: ANONYMOUS_STORAGE_STATE });

  test("muestra la organización y al menos un horario, sin exigir sesión", async ({ page }) => {
    const response = await page.goto(`/${ORG_SLUG}`);
    expect(response?.ok(), `GET /${ORG_SLUG} no respondió 2xx`).toBeTruthy();

    // The organization's own name, in the header -- never empty.
    const heading = page.locator("h1").first();
    await expect(heading).toBeVisible();
    await expect(heading).not.toHaveText("");

    // Anonymous, not signed in: the header offers "Ingresar", not
    // "Mi agenda" (which only a signed-in visitor sees).
    await expect(page.getByRole("link", { name: "Ingresar" })).toBeVisible();

    // At least one schedule/slot on the calendar: the empty state
    // (`data-slot="empty-state"`, ADR-0039's UI-consistency rule) must be
    // absent from the calendar area. If it appears, either the services
    // list or this window of the calendar is truly empty -- worth failing
    // loudly rather than silently asserting nothing.
    await expect(page.locator('main [data-slot="empty-state"]')).toHaveCount(0);
  });

  test("no puede reservar ni ver datos privados: un horario disponible manda a /login", async ({ page }) => {
    await page.goto(`/${ORG_SLUG}`);

    // A full slot renders without a link (schedule-calendar.tsx); an open
    // one links to /reservar/confirmar. Pick the first bookable one, if any
    // is visible in the default week view.
    const bookable = page.locator(`a[href*="/${ORG_SLUG}/reservar/confirmar"]`).first();
    if ((await bookable.count()) === 0) {
      test.skip(true, "No hay ningún horario reservable en la semana visible por defecto para probar el redirect.");
    }

    await bookable.click();
    // ConfirmarPage bounces anyone unauthenticated straight to /login,
    // carrying the booking intent in `returnTo` -- never books on their
    // behalf, never shows another customer's data.
    await page.waitForURL(/\/login/, { timeout: 20_000 });
    expect(new URL(page.url()).pathname).toBe("/login");

    // Nothing private (customer names, bookings, payments) is reachable
    // from here: no admin surface is linked from this unauthenticated path.
    await expect(page.locator(`a[href^="/org/${ORG_SLUG}"]`)).toHaveCount(0);
  });
});
