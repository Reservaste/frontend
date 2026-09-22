"use server";

import { revalidatePath } from "next/cache";
import { createServiceSchema, mapService } from "@reservaste/domain";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizationMembership } from "@/app/actions/organizations";

export interface CreateServiceState {
  error: string | null;
  /** Set only by updateService, so an edit row knows to close itself. */
  saved?: boolean;
}

export async function createService(
  organizationSlug: string,
  _prevState: CreateServiceState,
  formData: FormData,
): Promise<CreateServiceState> {
  const { organization } = await requireOrganizationMembership(organizationSlug);

  const parsed = createServiceSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("services").insert({
    organization_id: organization.id,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    created_by: user?.id,
  });

  if (error) {
    return { error: "No se pudo crear el servicio" };
  }

  revalidatePath(`/org/${organizationSlug}/services`);
  return { error: null };
}

export async function updateService(
  organizationSlug: string,
  serviceId: string,
  _prevState: CreateServiceState,
  formData: FormData,
): Promise<CreateServiceState> {
  const { organization } = await requireOrganizationMembership(organizationSlug);

  const parsed = createServiceSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("services")
    .update({ name: parsed.data.name, description: parsed.data.description ?? null })
    .eq("id", serviceId)
    .eq("organization_id", organization.id);

  if (error) {
    return { error: "No se pudo guardar el servicio" };
  }

  revalidatePath(`/org/${organizationSlug}/services`);
  return { error: null, saved: true };
}

/**
 * Archiving, not deleting: a Service has bookings and payment history
 * hanging off it, and domain.md's rule is that history is never rewritten.
 * It disappears from the public calendar and can't be booked again.
 */
export async function archiveService(organizationSlug: string, serviceId: string): Promise<void> {
  const { organization } = await requireOrganizationMembership(organizationSlug);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase
    .from("services")
    .update({
      is_active: false,
      cancelled_at: new Date().toISOString(),
      cancelled_by: user?.id,
      cancellation_reason: "DISCONTINUED_BY_ORGANIZATION",
    })
    .eq("id", serviceId)
    .eq("organization_id", organization.id);

  revalidatePath(`/org/${organizationSlug}/services`);
}

export async function listServices(organizationSlug: string) {
  const { organization } = await requireOrganizationMembership(organizationSlug);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("organization_id", organization.id)
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map(mapService);
}


export interface ServiceSettingsState {
  error: string | null;
  success: string | null;
}

/**
 * Configuration of a service that is *not* a price (ADR-0024): whether a
 * payment covering the slot's date is required to book it, and the colour
 * that tells it apart on the calendar.
 *
 * What it costs no longer lives here. `billing_type`, `billing_cycle` and
 * `price` moved up to `service_plans`, because one service now has one
 * ONE_TIME plan and three MONTHLY ones and a single column per service
 * cannot express that. `payment_required` stays: it is the "this service
 * demands payment" switch, not a price.
 *
 * The real rules live in the database. This maps the constraint and
 * trigger names back to something readable instead of re-implementing them.
 */
export async function updateServiceSettings(
  organizationSlug: string,
  serviceId: string,
  _prev: ServiceSettingsState,
  formData: FormData,
): Promise<ServiceSettingsState> {
  const { organization, membership } = await requireOrganizationMembership(organizationSlug);
  if (membership.role !== "OWNER") {
    return { error: "Solo el dueño puede cambiar la configuración de cobro", success: null };
  }

  const paymentRequired = formData.get("paymentRequired") === "on";
  const color = String(formData.get("color") ?? "").trim();

  const supabase = await createClient();

  const update: Record<string, unknown> = {
    payment_required: paymentRequired,
    color: color || null,
  };

  // No bridge to a deprecated column here any more: Phase 18 dropped the
  // Phase 14 CHECK that tied payment_required to billing_type. A service
  // that demands payment and has no plan on sale is caught where it
  // matters -- SERVICE_HAS_NO_PLAN, at the moment someone tries to book.

  const { error } = await supabase
    .from("services")
    .update(update)
    .eq("id", serviceId)
    .eq("organization_id", organization.id);

  if (error) {
    if (error.message.includes("SERVICE_HAS_ACTIVE_QUOTA_PLANS")) {
      return {
        error:
          "Este servicio tiene planes de turnos fijos por semana activos, que sin pago no pueden limitar nada. Desactivalos en Planes y volvé a intentarlo.",
        success: null,
      };
    }
    if (error.message.includes("services_color_format")) {
      return { error: "El color tiene que ser un hexadecimal como #0067e1", success: null };
    }
    return { error: "No se pudo guardar la configuración del servicio", success: null };
  }

  // Turning payment off can confirm pending dates of a standing
  // reservation (ADR-0019), which live on other screens.
  revalidatePath(`/org/${organizationSlug}`, "layout");
  return { error: null, success: "Configuración actualizada" };
}
