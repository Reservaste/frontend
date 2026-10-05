import type { ServicePlanKind } from "@reservaste/domain";

/**
 * Upgrade de plan a mitad de período (ADR-0050, Issue #4).
 *
 * Módulo plano (no "use server"): lo leen server actions y componentes de
 * cliente. Nada de esto decide: la RPC `admin_upgrade_payment` revalida todo
 * (mayor frecuencia, misma cobertura, fechas); acá sólo se ofrece lo
 * razonable y se traducen sus errores.
 */

export interface UpgradePlanLike {
  id: string;
  planKind: ServicePlanKind;
  weeklyQuota: number | null;
  isActive: boolean;
  serviceIds: string[];
}

/** UNLIMITED > WEEKLY_QUOTA con más cuota; el resto no es un upgrade. */
export function isHigherPlan(
  current: Pick<UpgradePlanLike, "planKind" | "weeklyQuota">,
  candidate: Pick<UpgradePlanLike, "planKind" | "weeklyQuota">,
): boolean {
  if (current.planKind !== "WEEKLY_QUOTA") return false;
  if (candidate.planKind === "UNLIMITED") return true;
  return (
    candidate.planKind === "WEEKLY_QUOTA" && (candidate.weeklyQuota ?? 0) > (current.weeklyQuota ?? 0)
  );
}

/**
 * Planes a los que se puede subir: activos, no DROP_IN, de mayor frecuencia
 * y que cubren los mismos servicios (la RPC exige misma cobertura).
 */
export function upgradeCandidates<T extends UpgradePlanLike>(current: UpgradePlanLike, plans: T[]): T[] {
  const sameScope = (a: string[], b: string[]) => a.length === b.length && a.every((id) => b.includes(id));
  return plans.filter(
    (plan) =>
      plan.id !== current.id &&
      plan.isActive &&
      plan.planKind !== "DROP_IN" &&
      isHigherPlan(current, plan) &&
      sameScope(current.serviceIds, plan.serviceIds),
  );
}

/** Hoy si cae en (periodStart, periodEnd]; si no, el día siguiente al inicio. */
export function defaultEffectiveDate(today: string, periodStart: string, periodEnd: string): string {
  if (today > periodStart && today <= periodEnd) return today;
  if (today > periodEnd) return periodEnd;
  const next = new Date(`${periodStart}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const key = next.toISOString().slice(0, 10);
  return key > periodEnd ? periodEnd : key;
}

/** Un pago puede tener upgrade si está PAID, es de período y se puede partir (más de un día). */
export function canUpgradePayment(
  payment: { status: string; slotOccurrenceId?: string | null; periodStart: string; periodEnd: string },
  plan: Pick<UpgradePlanLike, "planKind"> | undefined,
): boolean {
  return (
    payment.status === "PAID" &&
    !payment.slotOccurrenceId &&
    !!plan &&
    plan.planKind === "WEEKLY_QUOTA" &&
    payment.periodEnd > payment.periodStart
  );
}

const UPGRADE_ERRORS: [string, string][] = [
  ["PAYMENT_UPGRADE_NOT_AUTHORIZED", "No tenés permiso para cambiar de plan este pago, o el pago ya no existe."],
  ["PAYMENT_UPGRADE_NOT_PAID", "Sólo se puede hacer upgrade de un pago que está cobrado (Pagado)."],
  [
    "PAYMENT_UPGRADE_NOT_PERIOD_PAYMENT",
    "Un turno suelto no tiene upgrade: el upgrade es para pagos de un período (mes, trimestre…).",
  ],
  [
    "PAYMENT_UPGRADE_INVALID_DATE",
    "La fecha efectiva tiene que estar dentro del período del pago, después del primer día. Recargá la pantalla por si el pago ya cambió.",
  ],
  ["PAYMENT_UPGRADE_PLAN_NOT_FOUND", "Ese plan ya no existe. Recargá la pantalla y elegí de nuevo."],
  ["PAYMENT_UPGRADE_SAME_PLAN", "El plan nuevo es el mismo que el actual. Elegí uno de mayor frecuencia."],
  ["PAYMENT_UPGRADE_PLAN_INACTIVE", "Ese plan está desactivado. Elegí un plan activo."],
  [
    "PAYMENT_UPGRADE_PLAN_DROP_IN",
    "Un plan de turno suelto no sirve para un upgrade: elegí un plan de turnos fijos o libre.",
  ],
  [
    "PAYMENT_UPGRADE_NOT_HIGHER_PLAN",
    "El plan nuevo tiene que ser de mayor frecuencia que el actual. Para bajar de plan hay que anular el pago y volver a cargarlo.",
  ],
  [
    "PAYMENT_UPGRADE_SCOPE_MISMATCH",
    "El plan nuevo no cubre los mismos servicios que el pago actual. Elegí un plan que cubra los mismos servicios.",
  ],
  ["PAYMENT_UPGRADE_INVALID_AMOUNT", "El monto no puede ser negativo."],
  [
    "payment_service_coverage_no_overlap",
    "Ya hay otro pago registrado que cubre parte de ese período (por ejemplo una renovación ya cargada). No se cambió nada.",
  ],
  [
    "PAYMENT_DUPLICATE_PERIOD",
    "Ya hay otro pago de este cliente para ese servicio que cubre parte de ese período. No se cambió nada.",
  ],
];

/** Mensaje en castellano para un error de `admin_upgrade_payment`. */
export function upgradeErrorMessage(message: string | null | undefined): string {
  const text = message ?? "";
  const hit = UPGRADE_ERRORS.find(([code]) => text.includes(code));
  return hit ? hit[1] : "No se pudo hacer el upgrade. No se cambió nada.";
}
