"use server";

import { revalidatePath } from "next/cache";
import type { ServicePlanKind } from "@reservaste/domain";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizationMembership } from "@/app/actions/organizations";
import type { ActionState } from "@/app/actions/admin";

// Solicitud de cambio de plan (Fase 28).
//
// Por qué "solicitud" y no "cambio": cambiar de plan a mitad de período
// es VOID + recargar (ADR-0024 resolución 1), o sea una operación de
// dinero. Sin cobro online -- ADR-0027 está bloqueada por la elección de
// pasarela -- un cambio que se aplicara solo tendría que crear cobertura
// que nadie cobró, que es exactamente lo que "pago != permiso"
// (ADR-0005/ADR-0013) existe para impedir. Así que el cliente ve el
// catálogo (listPublicServicePlans, en public.ts) y *pide* el cambio; el
// mostrador lo confirma cobrando, y ese cobro cierra el pedido solo.
//
// Nada de esto toca el motor de reservas: `plan_change_requests` no la
// lee ninguna función de decisión. Un pedido pendiente no habilita ni
// bloquea una sola reserva.
//
// Como en el resto de este archivo-tipo, la defensa no está acá: la
// tabla no tiene policies de escritura y cada RPC resuelve el Customer
// desde auth.uid() (ADR-0005). Esta capa valida para dar un mensaje
// decente y traduce los errores de la base al castellano.

export interface MyPlanChangeRequest {
  requestId: string;
  organizationSlug: string;
  organizationName: string;
  planId: string;
  planName: string;
  planPrice: number;
  planKind: ServicePlanKind;
  weeklyQuota: number | null;
  currency: string;
  /** El plan que lo cubría cuando pidió el cambio. Null si no tenía ninguno. */
  currentPlanName: string | null;
  note: string | null;
  createdAt: string;
  /** Null mientras está pendiente. */
  resolution: "APPLIED" | "DISMISSED" | null;
  resolvedAt: string | null;
}

export interface PlanChangeRequest {
  requestId: string;
  customerId: string;
  customerName: string;
  requestedPlanId: string;
  requestedPlanName: string;
  requestedPlanPrice: number;
  requestedPlanKind: ServicePlanKind;
  requestedWeeklyQuota: number | null;
  currentPlanId: string | null;
  currentPlanName: string | null;
  currentPlanPrice: number | null;
  currency: string;
  note: string | null;
  createdAt: string;
  resolution: "APPLIED" | "DISMISSED" | null;
  resolvedAt: string | null;
}

/** Turns the RPC's raised exceptions into something the person can act on. */
function describeRequestError(message: string | undefined): string {
  const text = message ?? "";

  if (text.includes("NOT_A_CUSTOMER")) {
    return "Todavía no sos cliente de este negocio. Escribiles para que te den de alta.";
  }
  if (text.includes("ALREADY_ON_PLAN")) {
    return "Ese es el plan que ya tenés.";
  }
  if (text.includes("SERVICE_PLAN_NOT_AVAILABLE")) {
    return "Ese plan ya no está disponible.";
  }
  if (text.includes("ORGANIZATION_INACTIVE")) {
    return "El negocio no está activo.";
  }
  if (text.includes("TOO_MANY_PENDING_PLAN_CHANGE_REQUESTS")) {
    return "Ya tenés varios pedidos esperando respuesta. Esperá a que el negocio te conteste.";
  }
  if (text.includes("NOTE_TOO_LONG")) {
    return "El mensaje es demasiado largo (máximo 500 caracteres).";
  }
  if (text.includes("AUTH_REQUIRED")) {
    return "Iniciá sesión para pedir el cambio de plan.";
  }

  return "No se pudo enviar el pedido";
}

/**
 * "Quiero cambiarme a este plan". El plan vigente no viaja desde el
 * cliente: lo resuelve la RPC con la misma función que usa el camino de
 * cobertura (resolve_covering_service_plan), en la fecha local de la
 * organización.
 *
 * Idempotente por diseño: repetir el pedido pendiente devuelve el mismo,
 * así que un doble click no genera dos tareas para el mostrador.
 */
export async function requestPlanChange(
  servicePlanId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const rawNote = String(formData.get("note") ?? "").trim();
  if (rawNote.length > 500) {
    return { error: "El mensaje es demasiado largo (máximo 500 caracteres).", success: null };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("request_plan_change", {
    p_service_plan_id: servicePlanId,
    p_note: rawNote === "" ? null : rawNote,
  });

  if (error) {
    return { error: describeRequestError(error.message), success: null };
  }

  revalidatePath("/me");
  revalidatePath("/me/servicios");
  return {
    error: null,
    success: "Le avisamos al negocio. Te van a contactar para confirmar el cambio y el cobro.",
  };
}

/** Mis pedidos, pendientes primero -- para que el botón no sea un agujero negro. */
export async function getMyPlanChangeRequests(): Promise<MyPlanChangeRequest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_plan_change_requests");

  if (error || !data) return [];

  return data.map(
    (row: {
      request_id: string;
      organization_slug: string;
      organization_name: string;
      plan_id: string;
      plan_name: string;
      plan_price: string | number;
      plan_kind: ServicePlanKind;
      weekly_quota: number | null;
      currency: string;
      current_plan_name: string | null;
      note: string | null;
      created_at: string;
      resolution: MyPlanChangeRequest["resolution"];
      resolved_at: string | null;
    }) => ({
      requestId: row.request_id,
      organizationSlug: row.organization_slug,
      organizationName: row.organization_name,
      planId: row.plan_id,
      planName: row.plan_name,
      planPrice: Number(row.plan_price),
      planKind: row.plan_kind,
      weeklyQuota: row.weekly_quota,
      currency: row.currency,
      currentPlanName: row.current_plan_name,
      note: row.note,
      createdAt: row.created_at,
      resolution: row.resolution,
      resolvedAt: row.resolved_at,
    }),
  );
}

/**
 * Lo que el mostrador tiene para atender. Por defecto sólo los
 * pendientes: un pedido ya cobrado se cierra solo (trigger sobre
 * `payments`), así que esta lista es trabajo real, no historial.
 */
export async function listPlanChangeRequests(
  organizationSlug: string,
  includeResolved = false,
): Promise<PlanChangeRequest[]> {
  const { organization } = await requireOrganizationMembership(organizationSlug);
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("organization_plan_change_requests", {
    p_organization_id: organization.id,
    p_include_resolved: includeResolved,
  });

  if (error || !data) return [];

  return data.map(
    (row: {
      request_id: string;
      customer_id: string;
      customer_name: string;
      requested_plan_id: string;
      requested_plan_name: string;
      requested_plan_price: string | number;
      requested_plan_kind: ServicePlanKind;
      requested_weekly_quota: number | null;
      current_plan_id: string | null;
      current_plan_name: string | null;
      current_plan_price: string | number | null;
      currency: string;
      note: string | null;
      created_at: string;
      resolution: PlanChangeRequest["resolution"];
      resolved_at: string | null;
    }) => ({
      requestId: row.request_id,
      customerId: row.customer_id,
      customerName: row.customer_name,
      requestedPlanId: row.requested_plan_id,
      requestedPlanName: row.requested_plan_name,
      requestedPlanPrice: Number(row.requested_plan_price),
      requestedPlanKind: row.requested_plan_kind,
      requestedWeeklyQuota: row.requested_weekly_quota,
      currentPlanId: row.current_plan_id,
      currentPlanName: row.current_plan_name,
      currentPlanPrice: row.current_plan_price === null ? null : Number(row.current_plan_price),
      currency: row.currency,
      note: row.note,
      createdAt: row.created_at,
      resolution: row.resolution,
      resolvedAt: row.resolved_at,
    }),
  );
}

/**
 * Cierra el pedido a mano. No mueve dinero ni cobertura: APPLIED es "ya
 * lo cobré", DISMISSED es "hablamos y no va". Cobrar el plan pedido
 * desde la pantalla de pagos lo cierra solo, así que esto es para los
 * casos en que la venta no pasó por ahí.
 *
 * `<form action>` target: devuelve void y reporta por la página.
 */
export async function resolvePlanChangeRequest(
  organizationSlug: string,
  requestId: string,
  resolution: "APPLIED" | "DISMISSED",
): Promise<void> {
  await requireOrganizationMembership(organizationSlug);
  const supabase = await createClient();

  await supabase.rpc("resolve_plan_change_request", {
    p_request_id: requestId,
    p_resolution: resolution,
  });

  revalidatePath(`/org/${organizationSlug}/plans`);
  revalidatePath(`/org/${organizationSlug}`, "layout");
}
