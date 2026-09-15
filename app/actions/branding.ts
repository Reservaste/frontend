"use server";

import { revalidatePath } from "next/cache";
import { normalizeBrandColor } from "@reservaste/domain";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizationMembership } from "@/app/actions/organizations";
import { LOGO_BUCKET } from "@/lib/logo";
import type { ActionState } from "@/app/actions/admin";

// Branding is owner-level (ADR-0020). The real gate is in SQL --
// organizations_update_owner for the columns, storage policies for the
// object -- so the checks here only exist to produce a readable message
// instead of a silent zero-row update.

async function requireOwner(organizationSlug: string) {
  const { organization, membership } = await requireOrganizationMembership(organizationSlug);
  if (membership.role !== "OWNER") return null;
  return organization;
}

/** Everything under /org/<slug> plus the public page, which is what the branding is for. */
function revalidateBranding(organizationSlug: string, publicSlug: string) {
  revalidatePath(`/org/${organizationSlug}`, "layout");
  revalidatePath(`/${publicSlug}`, "layout");
}

export async function updateBrandColor(
  organizationSlug: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const organization = await requireOwner(organizationSlug);
  if (!organization) {
    return { error: "Solo el dueño puede cambiar la identidad del negocio", success: null };
  }

  const raw = String(formData.get("brandColor") ?? "").trim();
  // An empty submission is "go back to the product default", not an error.
  const color = raw === "" ? null : normalizeBrandColor(raw);

  if (raw !== "" && color === null) {
    return { error: "El color tiene que ser un hexadecimal como #0067e1", success: null };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({ brand_color: color })
    .eq("id", organization.id);

  if (error) {
    return { error: "No se pudo guardar el color", success: null };
  }

  revalidateBranding(organizationSlug, organization.slug);
  return { error: null, success: color ? "Color actualizado" : "Volviste al color por defecto" };
}

/**
 * Records a logo that the browser already uploaded to storage.
 *
 * The upload itself happens client-side against the storage API (owner-
 * gated by its own policies) rather than through a server action: routing
 * the bytes through the Next server would double the transfer for no
 * gain, and the file never needs to be inspected here.
 */
export async function setLogo(organizationSlug: string, logoPath: string): Promise<ActionState> {
  const organization = await requireOwner(organizationSlug);
  if (!organization) {
    return { error: "Solo el dueño puede cambiar el logo", success: null };
  }

  const supabase = await createClient();
  const previous = organization.logoPath;

  const { error } = await supabase
    .from("organizations")
    .update({ logo_path: logoPath })
    .eq("id", organization.id);

  if (error) {
    // organizations_logo_path_scoped: the path has to live under this
    // organization's own id.
    return { error: "No se pudo guardar el logo", success: null };
  }

  // Best effort: a leftover object costs a few KB, a failed delete that
  // rolled back the new logo would cost the owner their change.
  if (previous && previous !== logoPath) {
    await supabase.storage.from(LOGO_BUCKET).remove([previous]);
  }

  revalidateBranding(organizationSlug, organization.slug);
  return { error: null, success: "Logo actualizado" };
}

export async function removeLogo(organizationSlug: string): Promise<ActionState> {
  const organization = await requireOwner(organizationSlug);
  if (!organization) {
    return { error: "Solo el dueño puede cambiar el logo", success: null };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({ logo_path: null })
    .eq("id", organization.id);

  if (error) {
    return { error: "No se pudo quitar el logo", success: null };
  }

  if (organization.logoPath) {
    await supabase.storage.from(LOGO_BUCKET).remove([organization.logoPath]);
  }

  revalidateBranding(organizationSlug, organization.slug);
  return { error: null, success: "Logo quitado" };
}
