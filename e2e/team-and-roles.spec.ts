import { test, expect } from "@playwright/test";
import { ORG_SLUG } from "./helpers";

test.describe("Equipo y roles", () => {
  test("el rol 'Profesor' ya existe, sin permiso de pagos", async ({ page }) => {
    await page.goto(`/org/${ORG_SLUG}/team`);

    const roleRow = page.locator('[data-slot="data-list-row"]').filter({ hasText: "Profesor" }).first();
    await expect(roleRow).toBeVisible();
    // `rolePermissionSummary()` (lib/role-labels.ts) only ever starts a
    // part with "Pagos:" when the role can view or manage payments -- its
    // absence here IS the assertion that "Profesor" has neither.
    await expect(roleRow).not.toContainText("Pagos:");
  });

  test("invitar y revocar a alguien nuevo no deja el cupo de equipo ocupado", async ({ page }) => {
    await page.goto(`/org/${ORG_SLUG}/team`);

    const stamp = Date.now();
    const name = `QA E2E ${stamp}`;
    const email = `qa-e2e-${stamp}@example.com`;

    const inviteButton = page.getByRole("button", { name: "+ Invitar al equipo" });
    await expect(inviteButton).toBeVisible();
    if (await inviteButton.isDisabled()) {
      // ADR-0039: the plan has exactly 2 team seats and one is already a
      // permanent fixture -- if the other is taken by something else
      // (another run, a real teammate), inviting one more here would
      // either fail loudly or, worse, succeed and have no free seat left
      // to revoke it from safely. Skip rather than risk a permanent seat
      // leak this suite can't clean up.
      test.skip(true, "El plan no tiene lugares de equipo libres ahora mismo.");
    }
    await inviteButton.click();

    await page.getByLabel("Nombre").fill(name);
    await page.getByLabel("Teléfono").fill("+598 99 000 000");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: /generar invitación/i }).click();

    // "Invitación lista": the sheet flips to the one-time link -- proof
    // the invitation was actually issued, not just that the form submitted.
    await expect(page.getByRole("heading", { name: "Invitación lista" })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Listo" }).click();

    try {
      const row = page.locator('[data-slot="data-list-row"]').filter({ hasText: email }).first();
      await expect(row).toBeVisible();
      await expect(row).toContainText(name);
    } finally {
      // ADR-0039: a test invitation is never left behind -- only 2 team
      // seats exist in this plan and one is already occupied on purpose.
      const row = page.locator('[data-slot="data-list-row"]').filter({ hasText: email }).first();
      if ((await row.count()) > 0) {
        const revokeTrigger = row.getByRole("button", { name: /revocar/i });
        if ((await revokeTrigger.count()) > 0) {
          await revokeTrigger.click();
          await page.getByRole("button", { name: "Sí, revocar" }).click();
          await expect(row).not.toBeVisible({ timeout: 15_000 });
        }
      }
    }
  });
});
