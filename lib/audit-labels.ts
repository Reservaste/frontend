import type { AuditLogEntry } from "@reservaste/domain";
import { formatMoney } from "@/lib/money";

/**
 * ADR-0032: the audit log, in words. Plain module (not "use server"), so it
 * is testable and usable from any component.
 *
 * Presentation only: every fact comes from `organization_audit_log()`,
 * which already masks a platform actor. Nothing here tries to resolve that
 * actor to a name -- there is no name to resolve, on purpose.
 */

/**
 * The day the log started recording (deploy of Fase 30, 2026-09-23). There
 * is no backfill: before this date nothing was recorded, and an empty list
 * without this caption reads as "nothing happened".
 */
export const AUDIT_LOG_STARTED_ON = "2026-09-23";

/** "23/09/2026". */
export function auditLogStartedLabel(): string {
  const [y, m, d] = AUDIT_LOG_STARTED_ON.split("-");
  return `${d}/${m}/${y}`;
}

const PAYMENT_STATUS: Record<string, string> = {
  PAID: "Pagado",
  PENDING: "Pendiente",
  OVERDUE: "Vencido",
  VOID: "Anulado",
};

const SUBSCRIPTION_STATUS: Record<string, string> = {
  TRIALING: "en prueba",
  ACTIVE: "activa",
  PAST_DUE: "con pago pendiente",
  SUSPENDED: "suspendida",
};

const BOOKING_CANCELLATION: Record<string, string> = {
  CUSTOMER_REQUEST: "a pedido del cliente",
  SLOT_CANCELLED: "porque se canceló el turno",
  RULE_DISCONTINUED: "porque se quitó el horario",
  SERIES_CANCELLED: "porque se quitó el horario fijo",
};

type Diff = { from?: unknown; to?: unknown };

function diff(metadata: Record<string, unknown>, key: string): Diff | null {
  const value = metadata[key];
  return value && typeof value === "object" && ("from" in value || "to" in value) ? (value as Diff) : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function amount(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** The one-line headline: what happened. */
export function auditActionTitle(entry: Pick<AuditLogEntry, "action" | "metadata">): string {
  const m = entry.metadata;
  switch (entry.action) {
    case "PAYMENT_CREATED":
      return "Se registró un pago";
    case "PAYMENT_STATUS_CHANGED":
      return diff(m, "status")?.to === "VOID" ? "Se anuló un pago" : "Cambió el estado de un pago";
    case "BOOKING_CREATED_BY_STAFF":
      return "Se anotó a un cliente en un turno";
    case "BOOKING_CANCELLED_BY_STAFF":
      return "Se canceló una reserva";
    case "SERVICE_PLAN_CREATED":
      return "Se creó un plan";
    case "SERVICE_PLAN_UPDATED":
      if (diff(m, "price")) return "Se cambió el precio de un plan";
      if (diff(m, "name")) return "Se cambió el nombre de un plan";
      return "Se reordenaron los planes";
    case "SERVICE_PLAN_DEACTIVATED":
      return diff(m, "is_active")?.to === true ? "Se reactivó un plan" : "Se desactivó un plan";
    case "ORGANIZATION_SUBSCRIPTION_CHANGED": {
      const to = diff(m, "subscription_status")?.to;
      if (to === "SUSPENDED") return "Se suspendió la cuenta";
      if (to === "ACTIVE") return "Se reactivó la cuenta";
      if (diff(m, "plan_code")) return "Cambió el plan de la cuenta";
      return "Cambió el estado de la cuenta";
    }
    default:
      return "Acción registrada";
  }
}

/**
 * The details that add something -- "de $ 2.500 a $ 3.400", "de Pendiente a
 * Anulado". `names` resolves ids the metadata carries (customer, plan) to
 * what the owner can already see elsewhere in the panel; an unknown id is
 * simply left out rather than shown raw.
 */
export function auditActionDetails(
  entry: Pick<AuditLogEntry, "action" | "metadata">,
  currency: string,
  names: { customers: Record<string, string>; plans: Record<string, string> },
): string[] {
  const m = entry.metadata;
  const details: string[] = [];
  const customer = text(m.customer_id) ? names.customers[m.customer_id as string] : undefined;

  switch (entry.action) {
    case "PAYMENT_CREATED": {
      if (customer) details.push(customer);
      const plan = text(m.service_plan_id) ? names.plans[m.service_plan_id as string] : undefined;
      if (plan) details.push(plan);
      const value = amount(m.amount);
      if (value !== null) details.push(formatMoney(value, currency));
      if (text(m.status)) details.push(PAYMENT_STATUS[m.status as string] ?? (m.status as string));
      if (text(m.period_start) && text(m.period_end)) details.push(`${m.period_start} → ${m.period_end}`);
      break;
    }
    case "PAYMENT_STATUS_CHANGED": {
      if (customer) details.push(customer);
      const status = diff(m, "status");
      if (status) {
        details.push(
          `de ${PAYMENT_STATUS[String(status.from)] ?? String(status.from)} a ${PAYMENT_STATUS[String(status.to)] ?? String(status.to)}`,
        );
      }
      break;
    }
    case "BOOKING_CREATED_BY_STAFF":
      if (customer) details.push(customer);
      break;
    case "BOOKING_CANCELLED_BY_STAFF": {
      if (customer) details.push(customer);
      const reason = text(m.cancellation_reason);
      if (reason && BOOKING_CANCELLATION[reason]) details.push(BOOKING_CANCELLATION[reason]);
      break;
    }
    case "SERVICE_PLAN_CREATED": {
      if (text(m.name)) details.push(`«${m.name}»`);
      const value = amount(m.price);
      if (value !== null) details.push(formatMoney(value, currency));
      break;
    }
    case "SERVICE_PLAN_UPDATED": {
      const name = diff(m, "name");
      if (name) details.push(`nombre: de «${String(name.from)}» a «${String(name.to)}»`);
      const price = diff(m, "price");
      if (price) {
        const from = amount(price.from);
        const to = amount(price.to);
        if (from !== null && to !== null) {
          details.push(`precio: de ${formatMoney(from, currency)} a ${formatMoney(to, currency)}`);
        }
      }
      break;
    }
    case "ORGANIZATION_SUBSCRIPTION_CHANGED": {
      const status = diff(m, "subscription_status");
      if (status) {
        details.push(
          `de ${SUBSCRIPTION_STATUS[String(status.from)] ?? String(status.from)} a ${SUBSCRIPTION_STATUS[String(status.to)] ?? String(status.to)}`,
        );
      }
      const plan = diff(m, "plan_code");
      if (plan) details.push(`plan: de ${String(plan.from ?? "ninguno")} a ${String(plan.to ?? "ninguno")}`);
      break;
    }
    default:
      break;
  }

  // `note` is free context an RPC set. An all-caps code (e.g.
  // PLATFORM_CONSOLE) is internal vocabulary, not something to show.
  const note = text(m.note);
  if (note && !/^[A-Z0-9_]+$/.test(note)) details.push(`Nota: ${note}`);

  return details;
}

/**
 * Who did it. A platform actor is never resolved to a name nor shown as an
 * id -- the read already returns null for both (ADR-0032 resolución 2).
 */
export function auditActorLabel(entry: Pick<AuditLogEntry, "actorId" | "actorName" | "actorIsPlatform">): string {
  if (entry.actorIsPlatform) return "Soporte de Reservaste";
  if (entry.actorId === null) return "Sistema";
  return entry.actorName ?? "Alguien del equipo";
}
