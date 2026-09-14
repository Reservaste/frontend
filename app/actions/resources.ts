"use server";

import { revalidatePath } from "next/cache";
import { createResourceSchema, mapResource } from "@reservaste/domain";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizationMembership } from "@/app/actions/organizations";

export interface CreateResourceState {
  error: string | null;
}

export async function createResource(
  organizationSlug: string,
  _prevState: CreateResourceState,
  formData: FormData,
): Promise<CreateResourceState> {
  const { organization } = await requireOrganizationMembership(organizationSlug);

  const parsed = createResourceSchema.safeParse({
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

  const { error } = await supabase.from("resources").insert({
    organization_id: organization.id,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    created_by: user?.id,
  });

  if (error) {
    return { error: "No se pudo crear el recurso" };
  }

  revalidatePath(`/org/${organizationSlug}/resources`);
  return { error: null };
}

export async function listResources(organizationSlug: string) {
  const { organization } = await requireOrganizationMembership(organizationSlug);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("resources")
    .select("*")
    .eq("organization_id", organization.id)
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map(mapResource);
}
