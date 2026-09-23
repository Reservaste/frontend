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

  // ADR-0025, resolución 3: el crédito de recupero es opt-in del dueño
  // (`makeup_credits_enabled` default false) justamente para que el día
  // del deploy no cambie el comportamiento de nadie. Hasta la Fase 25 el
  // interruptor existía en la base y NO lo escribía nada: ninguna
  // organización podía encenderlo, así que "liberar cupo" cancelaba la
  // fecha y nunca emitía el crédito -- issue_makeup_credit() sale en su
  // condición 1. Es el motivo real de "liberar cupo no genera crédito".
  //
  // Los campos son opcionales: un formulario que todavía no los manda
  // (la pantalla la arma frontend-engineer) deja la configuración como
  // está en vez de apagar el crédito de quien ya lo tenía encendido.
  const makeupPatch: Record<string, unknown> = {};

  if (formData.has("makeupCreditsEnabled")) {
    makeupPatch.makeup_credits_enabled = formData.get("makeupCreditsEnabled") === "on";
  }

  if (formData.has("releaseDeadlineHours")) {
    const hours = Number(formData.get("releaseDeadlineHours"));
    // La anticipación es la política entera: en 0 el crédito se emite
    // cancelando en la puerta del salón, que es exactamente lo que
    // ADR-0025 vino a impedir.
    if (!Number.isInteger(hours) || hours < 1 || hours > 720) {
      return { error: "La anticipación tiene que estar entre 1 y 720 horas", success: null };
    }
    makeupPatch.release_deadline_hours = hours;
  }

  if (formData.has("makeupCreditExpiry")) {
    const basis = String(formData.get("makeupCreditExpiry"));
    if (!["END_OF_MONTH", "END_OF_BILLING_PERIOD", "DAYS_AFTER"].includes(basis)) {
      return { error: "Elegí cuándo vence el crédito de recupero", success: null };
    }
    makeupPatch.makeup_credit_expiry = basis;

    // Solo DAYS_AFTER usa el número; guardarlo en los otros dos modos deja
    // un valor que no se lee y que la próxima lectura interpreta mal.
    if (basis === "DAYS_AFTER") {
      const days = Number(formData.get("makeupCreditExpiryDays"));
      if (!Number.isInteger(days) || days < 1 || days > 365) {
        return { error: "Los días de vencimiento tienen que estar entre 1 y 365", success: null };
      }
      makeupPatch.makeup_credit_expiry_days = days;
    } else {
      makeupPatch.makeup_credit_expiry_days = null;
    }
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
      ...makeupPatch,
    })
    .eq("id", organization.id);

  if (error) {
    return { error: "No se pudo guardar la configuración", success: null };
  }

  revalidatePath(`/org/${organizationSlug}/settings`);
  return { error: null, success: "Configuración guardada" };
}
