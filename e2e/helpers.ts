import { expect, type Locator, type Page } from "@playwright/test";

/**
 * The permanent QA organization (ADR-0039). Real, shared, mutable state --
 * never recreated and never wiped. Every helper/spec here either reuses
 * what's already in it (resources, services, plans, the four "Cliente
 * Uno".."Cuatro" customers, the "Profesor" role, the Thursday/Friday fixed
 * schedules) or creates something small and cleans it up in the same test.
 */
export const ORG_SLUG = process.env.QA_ORG_SLUG ?? "redentor";

/**
 * A blank Playwright `storageState`, for the few specs that must run
 * unauthenticated (the public calendar, the login screen itself) even
 * though `playwright.config.ts`'s default `use.storageState` signs every
 * other spec in as the QA owner: `test.use({ storageState:
 * ANONYMOUS_STORAGE_STATE })` at the top of that file/describe block.
 */
export const ANONYMOUS_STORAGE_STATE = { cookies: [], origins: [] };

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Falta la variable de entorno ${name}. La suite corre contra producción real y necesita credenciales reales -- no hay fallback hardcodeado a propósito.`,
    );
  }
  return value;
}

/**
 * Signs in through the real login form.
 *
 * `login-form.tsx`'s submit is a server action (`useActionState`), not a
 * classic navigation: the button's own label flips to "Ingresando…" while
 * the action is in flight, and if you wait for `networkidle` right after
 * the click, it can resolve mid-flight -- the URL is still `/login` and any
 * assertion right after reads stale state. What actually works: wait for
 * the URL to leave `/login` first (the server action's own `redirect()`),
 * and only then wait for the page to settle.
 */
export async function login(page: Page, email: string, password: string, returnTo = "/dashboard") {
  await page.goto(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 20_000 });
  await page.waitForLoadState("networkidle");
}

/**
 * Reads an element's rendered text the way a person reading the screen
 * would -- uppercased where CSS (`.eyebrow { text-transform: uppercase }`)
 * uppercases it -- and compares case-insensitively.
 *
 * `.textContent()`/Playwright's own text matchers ignore CSS text-transform
 * (they read the DOM string, "Anotados"), but `.innerText()` renders it
 * ("ANOTADOS") -- mixing the two, or comparing `.innerText()` against a
 * literal "Anotados", is a real trap that was hit operating this app by
 * hand once. Anything in this file that reads text with `.innerText()`
 * goes through this so the case question only has to be answered once.
 */
export async function innerTextUpper(locator: Locator): Promise<string> {
  return (await locator.innerText()).toUpperCase();
}

// ---------------------------------------------------------------------------
// Occurrence detail page ("Anotados (N)", anotar/quitar a un cliente)
// ---------------------------------------------------------------------------

/** The "Anotados (N)" section of an occurrence detail page. */
export function anotadosSection(page: Page): Locator {
  return page.locator("section").filter({ has: page.getByRole("heading", { name: /anotados/i, level: 4 }) });
}

/** Current "Anotados (N)" count, read reliably (see `innerTextUpper`). */
export async function getAnotadosCount(page: Page): Promise<number> {
  const heading = anotadosSection(page).getByRole("heading", { name: /anotados/i, level: 4 });
  const text = await innerTextUpper(heading);
  const match = text.match(/\((\d+)\)/);
  if (!match) throw new Error(`No se pudo leer el contador de "Anotados" en: "${text}"`);
  return Number(match[1]);
}

/**
 * Waits for the "Anotados (N)" heading to actually show the expected count.
 *
 * A real race lives here: clicking "Anotar" (or "Quitar") re-runs a server
 * action and revalidates the list, but nothing stops a second action from
 * firing before the first one's new count has painted. Polling this
 * explicitly -- instead of trusting `networkidle` alone -- is what a caller
 * needs before triggering a second booking/cancellation on the same
 * occurrence; skipping it once lost a reservation in silence.
 */
export async function waitForAnotadosCount(page: Page, expected: number): Promise<void> {
  const heading = anotadosSection(page).getByRole("heading", { name: /anotados/i, level: 4 });
  await expect(async () => {
    const text = await innerTextUpper(heading);
    expect(text).toMatch(new RegExp(`\\(${expected}\\)`));
  }).toPass({ timeout: 15_000 });
}

/** Full names currently listed under "Anotados" on the open occurrence page. */
export async function listAnotadoNames(page: Page): Promise<string[]> {
  const rows = anotadosSection(page).locator("ul li");
  const count = await rows.count();
  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    names.push((await rows.nth(i).locator("span").first().innerText()).trim());
  }
  return names;
}

/** The first of `candidates` not already booked into the open occurrence. */
export async function pickCustomerNotYetBooked(page: Page, candidates: string[]): Promise<string> {
  const already = (await listAnotadoNames(page)).map((n) => n.toUpperCase());
  const free = candidates.find((name) => !already.includes(name.toUpperCase()));
  if (!free) {
    throw new Error(
      `Los ${candidates.length} clientes de prueba (${candidates.join(", ")}) ya están anotados en este turno -- no queda ninguno libre para el round-trip de reserva.`,
    );
  }
  return free;
}

/**
 * "Anotar cliente": picks `customerName` in the select and submits, waiting
 * for the confirmed count to actually move before returning -- see
 * `waitForAnotadosCount`.
 */
export async function bookCustomerIntoOccurrence(page: Page, customerName: string): Promise<void> {
  const before = await getAnotadosCount(page);
  await page.locator('select[name="customerId"]').selectOption({ label: customerName });
  await page.getByRole("button", { name: /^anotar$/i }).click();
  await waitForAnotadosCount(page, before + 1);
}

/** Staff-side "Quitar" on one attendee row, waiting for the count to drop. */
export async function removeAttendeeFromOccurrence(page: Page, customerName: string): Promise<void> {
  const before = await getAnotadosCount(page);
  const row = anotadosSection(page).locator("li").filter({ hasText: customerName });
  await row.getByRole("button", { name: /quitar/i }).click();
  await waitForAnotadosCount(page, before - 1);
}

// ---------------------------------------------------------------------------
// Find-or-create (ADR-0039: never create test fixtures twice)
// ---------------------------------------------------------------------------

/**
 * Generic "search the list screen for a name, create it if it's missing" --
 * today used for a managed customer and a resource (`findOrCreateManagedCustomer`,
 * `findOrCreateResource` below); nothing else calls it yet. `redentor`
 * already has every fixture this suite needs (see `ORG_SLUG`'s doc comment)
 * -- this exists so a spec, or a future one, never has to special-case
 * "what if it's not there this time" by hand, and so nothing gets created
 * twice across runs.
 */
export async function findOrCreate(
  page: Page,
  options: {
    /** Where the list of this entity lives. */
    listUrl: string;
    /** The name to look for among the rows already on the list. */
    name: string;
    /** Runs only when `name` isn't found; must leave the list showing it. */
    create: () => Promise<void>;
  },
): Promise<void> {
  await page.goto(options.listUrl);
  const existing = page.getByText(options.name, { exact: true }).first();
  if (await existing.count() > 0) {
    return;
  }
  await options.create();
  await expect(page.getByText(options.name, { exact: true }).first()).toBeVisible({ timeout: 15_000 });
}

/** A managed customer ("cliente sin cuenta", ADR-0026), found or created. */
export async function findOrCreateManagedCustomer(
  page: Page,
  slug: string,
  fullName: string,
  phone: string,
): Promise<void> {
  await findOrCreate(page, {
    listUrl: `/org/${slug}/customers`,
    name: fullName,
    create: async () => {
      await page.getByRole("button", { name: "+ Cliente sin cuenta" }).click();
      await page.getByLabel("Nombre").fill(fullName);
      await page.getByLabel("Teléfono").fill(phone);
      await page.getByRole("button", { name: /guardar y enviar/i }).click();
      // "Cliente creado": the sheet flips to the WhatsApp hand-off, close it.
      const done = page.getByRole("button", { name: "Listo" });
      if (await done.count() > 0) await done.click();
    },
  });
}

/**
 * The four "Cliente Uno".."Cuatro" test customers `redentor` already has
 * (ADR-0039) -- created here only as a fallback if the dataset was ever
 * reset, never a second time otherwise (`findOrCreateManagedCustomer`
 * already checks first).
 */
export async function ensureTestCustomers(page: Page, slug: string, names: string[]): Promise<void> {
  for (const name of names) {
    await findOrCreateManagedCustomer(page, slug, name, "+598 99 000 000");
  }
}

/** A `Resource` (room/court/professional/etc.), found or created. */
export async function findOrCreateResource(page: Page, slug: string, name: string): Promise<void> {
  await findOrCreate(page, {
    listUrl: `/org/${slug}/resources`,
    name,
    create: async () => {
      await page.getByRole("button", { name: "+ Nuevo recurso" }).click();
      await page.getByLabel("Nombre").fill(name);
      await page.getByRole("button", { name: /crear recurso/i }).click();
    },
  });
}

// ---------------------------------------------------------------------------
// Billing period math (mirrors `lib/billing-period.ts`) and collision-free
// period lookup, shared by the payment specs (ADR-0038, audit log).
// ---------------------------------------------------------------------------

/** Mirrors `lib/billing-period.ts`'s `inclusiveDays`. */
export function inclusiveDays(from: string, to: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return null;
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  return days > 0 ? days : null;
}

/** Mirrors `lib/billing-period.ts`'s `round2`. */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function currentMonth(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthOffset(base: string, months: number): string {
  const [y, m] = base.split("-").map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + months, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** "YYYY-MM" -> the ISO date of that month's last day. */
export function lastDayOfMonthISO(month: string): string {
  const [y, m] = month.split("-").map(Number);
  // Day 0 of the *next* month is the last day of this one.
  return new Date(Date.UTC(y!, m!, 0)).toISOString().slice(0, 10);
}

/** customer name -> customerId, read straight from the `/customers` list. */
export async function getTestCustomerIds(
  page: Page,
  slug: string,
  names: string[],
): Promise<Map<string, string>> {
  await page.goto(`/org/${slug}/customers`);
  const ids = new Map<string, string>();
  for (const name of names) {
    // Exact match on the name's own element (`filter({has: getByText(...,
    // {exact: true})})`), not a substring `hasText` on the whole row: a
    // substring match could latch onto a real customer whose name merely
    // *contains* "Cliente Uno" (e.g. a rename, or a coincidence), which
    // `.first()` would then silently treat as the fixture.
    const row = page
      .locator(`a[href^="/org/${slug}/customers/"]`)
      .filter({ has: page.getByText(name, { exact: true }) })
      .first();
    const href = await row.getAttribute("href");
    if (href) ids.set(name, href.split("/").pop()!);
  }
  return ids;
}

/**
 * The first (customer, month) pair, among `customerIds`, with no *live*
 * (non-`VOID`) payment registered -- a period the database's own
 * `EXCLUDE` on `payment_service_coverage` (ADR-0022/0024) would actually
 * accept a new payment for.
 *
 * Counts only non-`VOID` rows on purpose, not "zero rows at all": a `VOID`
 * payment doesn't hold the `EXCLUDE`'s range (that's the whole point of
 * voiding instead of leaving a mistaken row PENDING), so a month where
 * every existing row is `VOID` is genuinely free. Treating any row,
 * including `VOID` ones, as "occupied" was the original version of this
 * function -- it permanently burns two of the 24 (customer, month) pairs
 * per suite run (this function always finds *a* free month, registers a
 * payment there, and that same helper later voids it -- so the month it
 * just used never reads as empty again under the old rule), which starts
 * making `payments-adr0038`/`audit-log` skip silently after roughly a
 * dozen runs.
 */
export async function findCustomerAndMonthWithNoPayments(
  page: Page,
  slug: string,
  customerIds: Map<string, string>,
  monthsAhead = 6,
): Promise<{ customerId: string; customerName: string; month: string } | null> {
  const base = currentMonth();
  for (let m = 0; m < monthsAhead; m++) {
    const month = monthOffset(base, m);
    for (const [name, customerId] of customerIds) {
      await page.goto(`/org/${slug}/payments/${customerId}?mes=${month}`);
      // "Servicios del período" is the only `DataList` this page renders.
      // Read as text rather than via `EmptyState`'s `data-slot` on
      // purpose: `DataListRow` already ships in production today, so this
      // doesn't depend on whichever frontend deploy happens to carry the
      // `data-slot="empty-state"` addition this suite also relies on
      // elsewhere (`components/ui/empty-state.tsx`) -- confirmed live
      // running this for real: with that attribute not yet deployed, an
      // earlier version of this check never found a match at all.
      const rowTexts = await page.locator('[data-slot="data-list-row"]').allTextContents();
      const liveRows = rowTexts.filter((text) => !/anulado/i.test(text));
      if (liveRows.length === 0) {
        return { customerId, customerName: name, month };
      }
    }
  }
  return null;
}

/**
 * The first `[data-slot="data-list-row"]` matching every one of `hasTexts`
 * that is NOT already "Anulado" -- an index-stable `Locator` (`.nth(i)`
 * against the *unfiltered* candidate list), never one built with
 * `.filter({ hasNotText: "Anulado" })` and then reused across the void
 * itself.
 *
 * That looks right until the exact state change it's about to help
 * verify: the moment "Anular" succeeds and the row's own text gains the
 * word "Anulado", a `hasNotText: "Anulado"` locator stops matching that
 * same row -- `expect(row.getByText(/anulado/i)).toBeVisible()` right
 * after clicking "Anular" through such a locator times out chasing a row
 * that, by then, has excluded itself. Confirmed hitting this for real
 * (payments-adr0038.spec.ts, audit-log.spec.ts).
 */
export async function findLivePaymentRow(page: Page, ...hasTexts: string[]): Promise<Locator | null> {
  let candidates = page.locator('[data-slot="data-list-row"]');
  for (const text of hasTexts) candidates = candidates.filter({ hasText: text });
  const count = await candidates.count();
  for (let i = 0; i < count; i++) {
    const text = await candidates.nth(i).innerText();
    if (!/anulado/i.test(text)) return candidates.nth(i);
  }
  return null;
}
