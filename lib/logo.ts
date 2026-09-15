export const LOGO_BUCKET = "organization-logos";

/**
 * Public URL for an organization's logo.
 *
 * The database stores the object path, not a URL: baking the project host
 * into every row means the data breaks if the project ever moves. The
 * bucket is public, so no signing is involved.
 */
export function logoUrl(logoPath: string | null | undefined): string | null {
  if (!logoPath) return null;

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;

  return `${base}/storage/v1/object/public/${LOGO_BUCKET}/${logoPath}`;
}

/** Up to two initials, the fallback when there is no logo. */
export function initialsOf(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}
