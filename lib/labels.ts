/**
 * Anything a person reads is Spanish; the raw enum values stay in the
 * database. OWNER/STAFF were leaking into the UI verbatim, which read as
 * a bug even to someone who speaks English.
 */
export const ROLE_LABELS: Record<string, string> = {
  OWNER: "Dueño",
  STAFF: "Equipo",
};

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}
