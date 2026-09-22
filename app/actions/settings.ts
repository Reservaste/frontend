"use server";

import { revalidatePath } from "next/cache";
import { currencySchema, timezoneSchema } from "@reservaste/domain";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizationMembership } from "@/app/actions/organizations";
import type { ActionState } from "@/app/actions/admin";

export async function updateOrganizationSettings(
  organizationSlug: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { organization, membership } = await requireOrganizationMembership(organizationSlug);

  if (membership.role !== "OWNER") {
    return { error: "Solo el dueño puede cambiar la configuración", success: null };
  }

  const timezone = String(formData.get("timezone") ?? "");
  const parsedTimezone = timezoneSchema.safeParse(timezone);
  if (!parsedTimezone.success) {
    return { error: parsedTimezone.error.issues[0]?.message ?? "Zona horaria inválida", success: null };
  }

  // The CHECK in the database only guarantees three uppercase letters, so
  // this is where a typo gets caught with a readable message instead of a
  // constraint violation. Every price of the organization is read in it.
  const currency = String(formData.get("currency") ?? "").trim().toUpperCase();
  const parsedCurrency = currencySchema.safeParse(currency);
  if (!parsedCurrency.success) {
    return {
      error: "La moneda tiene que ser un código de tres letras, como UYU, ARS o USD",
      success: null,
    };
  }

  const display = String(formData.get("publicAvailabilityDisplay") ?? "EXACT");
  const percentage = Number(formData.get("lowAvailabilityPercentage"));
  const fixedCapRaw = String(formData.get("lowAvailabilityFixedCap") ?? "").trim();

  if (!Number.isInteger(percentage) || percentage < 1 || percentage > 100) {
    return { error: "El porcentaje tiene que estar entre 1 y 100", success: null };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({
      name: String(formData.get("name") ?? organization.name),
      timezone: parsedTimezone.data,
      currency: parsedCurrency.data,
      public_availability_display: display,
      low_availability_percentage: percentage,
      low_availability_fixed_cap: fixedCapRaw ? Number(fixedCapRaw) : null,
    })
    .eq("id", organization.id);

  if (error) {
    return { error: "No se pudo guardar la configuración", success: null };
  }

  revalidatePath(`/org/${organizationSlug}/settings`);
  return { error: null, success: "Configuración guardada" };
}
