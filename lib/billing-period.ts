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

/**
 * ADR-0038: días inclusive entre dos fechas ISO ("YYYY-MM-DD"), el
 * denominador/numerador del prorrateo por días del monto sugerido de un
 * pago. `null` en vez de un número roto (NaN/negativo) cuando cualquiera de
 * las dos fechas no es una fecha completa -- un `<input type="date">`
 * pasa por ese estado mientras se está tipeando -- o cuando el rango queda
 * invertido (`to < from`): el llamador decide qué hacer con "no hay un
 * período válido todavía", nunca lo inventa esta función.
 */
export function inclusiveDays(from: string, to: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return null;
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  return days > 0 ? days : null;
}

/** Redondeo a centavos, el mismo criterio con el que se guarda un monto. */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
