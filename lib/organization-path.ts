import { organizationSlugSchema } from "@reservaste/domain";

/**
 * The public page of an organization -- which IS its agenda (ADR-0023) --
 * from a slug that came back from the database.
 *
 * It exists so that a redirect built from an RPC's return value can never
 * become an open redirect: `redirect("/" + slug)` with a slug containing
 * a slash, a backslash or a leading dot would leave the page we meant
 * (the same class of problem `safeReturnTo` guards for destinations that
 * come from the URL). The shape is not re-invented here: it is the same
 * `organizationSlugSchema` the database is fed through when the
 * organization is created, so this can only reject a slug that could
 * never have been stored.
 *
 * Returns `null` -- never a "cleaned up" path -- when the slug is missing
 * or malformed, so the caller has to decide on a fallback explicitly.
 */
export function organizationPath(slug: string | null | undefined): string | null {
  const parsed = organizationSlugSchema.safeParse(slug);
  return parsed.success ? `/${parsed.data}` : null;
}
