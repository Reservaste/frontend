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
