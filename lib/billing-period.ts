/**
 * The dates a month means. Pure logic, deliberately NOT in the
 * "use server" module: a server-action file can only export async
 * functions, and this is called from client components too.
 */
export function monthRange(month?: string): { from: string; to: string; month: string } {
  const base = month && /^\d{4}-\d{2}$/.test(month) ? `${month}-01` : null;
  const anchor = base ? new Date(`${base}T12:00:00Z`) : new Date();
  const year = anchor.getUTCFullYear();
  const m = anchor.getUTCMonth();
  const first = new Date(Date.UTC(year, m, 1));
  const last = new Date(Date.UTC(year, m + 1, 0));
  return {
    from: first.toISOString().slice(0, 10),
    to: last.toISOString().slice(0, 10),
    month: first.toISOString().slice(0, 7),
  };
}
