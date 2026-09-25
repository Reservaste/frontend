import { test, expect } from "@playwright/test";
import { ANONYMOUS_STORAGE_STATE, ORG_SLUG, requireEnv } from "./helpers";

const QA_EMAIL = requireEnv("QA_EMAIL");

test.describe("Login", () => {
  test("la sesión QA autenticada permite entrar al panel sin pasar por /login", async ({ page }) => {
    // The real form-based login (email + real password) happens exactly
    // once for the whole suite, in `global-setup.ts` -- never inside a
    // `test()` -- specifically so the password never ends up in the HTML
    // report's step titles (security review, ADR-0039). This test uses
    // the suite's default `storageState` (already the QA owner's session)
    // to confirm that session is actually valid: if `global-setup.ts`'s
    // login had silently produced a broken/expired session, every other
    // authenticated spec would fail in confusing ways instead of this one
    // failing with a clear "still on /login" message. `global-setup.ts`
    // itself failing outright (wrong credentials, login form broken) is
    // the stronger, earlier signal -- it aborts the whole run before any
    // spec, including this one, gets to execute.
    await page.goto(`/org/${ORG_SLUG}`);
    expect(new URL(page.url()).pathname).not.toContain("/login");
  });
});

test.describe("Login (sin sesión)", () => {
  // Both tests below have to actually see the login form, not the QA
  // owner's already-authenticated redirect away from /login -- overrides
  // the suite's default authenticated `storageState` (`playwright.config.ts`).
  test.use({ storageState: ANONYMOUS_STORAGE_STATE });

  test("sin sesión, /login muestra el formulario en vez de redirigir", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Contraseña")).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/login");
  });

  test("con contraseña incorrecta muestra error y no redirige", async ({ page }) => {
    // Never touches the real password (a wrong one, on purpose) -- the one
    // auth scenario that's still safe to exercise as an actual form
    // submission inside a `test()`.
    await page.goto("/login");
    await page.getByLabel("Email").fill(QA_EMAIL);
    await page.getByLabel("Contraseña").fill("esta-no-es-la-contraseña-e2e");
    await page.getByRole("button", { name: "Ingresar" }).click();

    // signInWithPassword() returns { error } instead of redirecting -- the
    // form re-renders in place, so there is nothing to "wait for the URL"
    // on: the assertion itself is what proves no redirect happened.
    //
    // Scoped to `FormError`'s own `data-slot` rather than `getByRole("alert")`:
    // Next.js's route announcer (`#__next-route-announcer__`) is *also*
    // `role="alert"` on every page, so the generic role query is ambiguous
    // (a real strict-mode violation hit running this against prod).
    await expect(page.locator('[data-slot="form-error"]')).toContainText(/email o contraseña incorrectos/i);
    expect(new URL(page.url()).pathname).toBe("/login");
  });
});
