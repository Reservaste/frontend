"use server";

import { revalidatePath } from "next/cache";
import { createResourceSchema, mapResource, type Resource, type ResourceRow } from "@reservaste/domain";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizationMembership } from "@/app/actions/organizations";

export interface CreateResourceState {
  error: string | null;
  /** Set only by updateResource, so an edit row knows to close itself. */
  saved?: boolean;
}

/**
 * ADR-0044: `resources.is_exclusive` was added straight to the migration
 * (`phase42_exclusive_resources.sql`) and its tests -- that PR never
 * touched `@reservaste/domain` (`Resource`/`mapResource()` in
 * `backend/src/`), so the field isn't typed there yet. Mapped by hand here
 * instead of blocking this screen on a domain-package republish; once
 * backend-engineer adds it to the package this local type/mapping can be
 * deleted in favour of the real one.
 */
export interface ResourceWithExclusive extends Resource {
  isExclusive: boolean;
}

function mapResourceWithExclusive(
  row: ResourceRow & { is_exclusive?: boolean | null },
): ResourceWithExclusive {
  return { ...mapResource(row), isExclusive: row.is_exclusive ?? false };
}

/**
 * `resources.is_exclusive` update/insert can fail with a raw Postgres
 * `exclusion_violation` (SQLSTATE 23P01, ADR-0044's `RESOURCE_HAS_OVERLAPS`)
 * when activating it on a resource that already has overlapping future
 * `ACTIVE` occurrences -- the `slot_occurrences_exclusive_resource_no_overlap`
 * constraint rejects the propagation trigger's update. That code is the
 * only reliable signal (the message names the constraint, not a fixed
 * string), so it is checked before falling back to a generic save error.
 */
function describeResourceSaveError(error: { code?: string }, fallback: string): string {
  if (error.code === "23P01") {
    return "Este recurso ya tiene turnos que se superponen -- resolvé los solapamientos antes de marcarlo como exclusivo.";
  }
  return fallback;
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

  const isExclusive = formData.get("isExclusive") === "on";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("resources").insert({
    organization_id: organization.id,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    is_exclusive: isExclusive,
    created_by: user?.id,
  });

  if (error) {
    return { error: describeResourceSaveError(error, "No se pudo crear el recurso") };
  }

  revalidatePath(`/org/${organizationSlug}/resources`);
  return { error: null };
}

export async function updateResource(
  organizationSlug: string,
  resourceId: string,
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

  const isExclusive = formData.get("isExclusive") === "on";

  const supabase = await createClient();
  const { error } = await supabase
    .from("resources")
    .update({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      is_exclusive: isExclusive,
    })
    .eq("id", resourceId)
    .eq("organization_id", organization.id);

  if (error) {
    return { error: describeResourceSaveError(error, "No se pudo guardar el recurso") };
  }

  revalidatePath(`/org/${organizationSlug}/resources`);
  return { error: null, saved: true };
}

/** Archived, not deleted -- schedules and their history still reference it. */
export async function archiveResource(organizationSlug: string, resourceId: string): Promise<void> {
  const { organization } = await requireOrganizationMembership(organizationSlug);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase
    .from("resources")
    .update({
      is_active: false,
      cancelled_at: new Date().toISOString(),
      cancelled_by: user?.id,
      cancellation_reason: "DISCONTINUED_BY_ORGANIZATION",
    })
    .eq("id", resourceId)
    .eq("organization_id", organization.id);

  revalidatePath(`/org/${organizationSlug}/resources`);
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

  return data.map(mapResourceWithExclusive);
}
