"use server";

import { revalidatePath } from "next/cache";
import { createServiceSchema, mapService } from "@reservaste/domain";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizationMembership } from "@/app/actions/organizations";

export interface CreateServiceState {
  error: string | null;
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
