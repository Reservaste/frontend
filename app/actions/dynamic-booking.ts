"use server";

// ADR-0051: disponibilidad dinámica para recursos exclusivos. Lectura
// pública (`getDynamicAvailability`, igual perímetro que
// `get_public_availability()` -- ADR-0008/ADR-0048) + el ciclo
// hold → confirmar, que sí exige sesión (a diferencia del flujo de
// `reservar/confirmar`, donde elegir es sólo lectura sobre una fila que ya
// existe -- acá holdear es un insert real sobre un recurso escaso).

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BOOKING_REASONS } from "@/lib/booking-reasons";
import { safeReturnTo } from "@/lib/return-to";
import type { BookingActionState } from "@/app/actions/customer";

export interface DynamicSlot {
  resourceId: string;
  /** ADR-0048: null salvo que la organización opte por `public_resource_names`. */
  resourceName: string | null;
  startAt: string;
  endAt: string;
}

/**
 * Horarios de inicio posibles para un servicio en un día, ya descontando lo
 * ocupado (`ACTIVE` y `HELD` vigente) de cualquier servicio del recurso.
 * Pública, sin auth.
 */
export async function getDynamicAvailability(
  organizationSlug: string,
  serviceId: string,
  date: string,
): Promise<DynamicSlot[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_dynamic_availability", {
    p_organization_slug: organizationSlug,
    p_service_id: serviceId,
    p_date: date,
  });

  if (error || !data) return [];

  // Deuda técnica conocida (docs/database.md, Fase 50):
  // create_resource_availability_window() no rechaza ni fusiona ventanas
  // superpuestas del mismo recurso/día -- dos ventanas que se pisan
  // producirían el mismo start_at dos veces. Dedupeado por
  // (resourceId, startAt) hasta que eso se cierre del lado del backend.
  const seen = new Set<string>();
  const slots: DynamicSlot[] = [];
  for (const row of data as {
    resource_id: string;
    resource_name: string | null;
    start_at: string;
    end_at: string;
  }[]) {
    const key = `${row.resource_id}:${row.start_at}`;
    if (seen.has(key)) continue;
    seen.add(key);
    slots.push({
      resourceId: row.resource_id,
      resourceName: row.resource_name ?? null,
      startAt: row.start_at,
      endAt: row.end_at,
    });
  }
  return slots;
}

export interface HoldDynamicSlotResult {
  error: string | null;
  slotOccurrenceId?: string;
  heldUntil?: string;
}

/**
 * Traba un horario por 5 minutos (ADR-0051) para que deje de verse
 * disponible para otra persona mientras ésta completa la reserva. Exige
 * sesión -- a diferencia del resto del flujo público, el login se resuelve
 * *antes* de este paso, no después (`hold_dynamic_slot` necesita
 * `auth.uid()` para poder limitar cuántos horarios puede trabar la misma
 * persona).
 */
export async function holdDynamicSlot(
  organizationSlug: string,
  resourceId: string,
  serviceId: string,
  startAtIso: string,
  returnTo: string,
): Promise<HoldDynamicSlotResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // organizationSlug no lo necesita hold_dynamic_slot() (no toma ningún
  // parámetro de organización) -- se mantiene en la firma por simetría con
  // el resto de las acciones públicas de este módulo, que siempre reciben
  // el slug primero.
  void organizationSlug;

  if (!user) {
    // Gate de seguridad (defensa en profundidad): esta es una server action
    // invocable directamente, así que `returnTo` lo controla quien la
    // llame -- /login ya pasa cualquier returnTo por safeReturnTo() antes
    // de redirigir, pero validarlo acá también evita depender de un único
    // control.
    redirect(`/login?returnTo=${encodeURIComponent(safeReturnTo(returnTo))}`);
  }

  const { data, error } = await supabase.rpc("hold_dynamic_slot", {
    p_resource_id: resourceId,
    p_service_id: serviceId,
    p_start_at: startAtIso,
  });

  if (error) {
    // RESOURCE_NOT_FOUND/SERVICE_NOT_FOUND/OUTSIDE_AVAILABILITY_WINDOW:
    // UI desincronizada (la grilla mostró algo que ya no existe o salió de
    // ventana) -- caso raro, no amerita un mensaje por cada uno.
    return { error: "No se pudo reservar este horario temporalmente" };
  }

  const result = data as { status: string; slot_occurrence_id?: string; held_until?: string };
  if (result.status !== "OK") {
    return { error: BOOKING_REASONS[result.status] ?? "No se pudo reservar este horario temporalmente" };
  }

  return { error: null, slotOccurrenceId: result.slot_occurrence_id, heldUntil: result.held_until };
}

/**
 * Confirma un hold propio y vigente. `organizationSlug` viaja bindeado
 * (no hay un `public_slot_detail()` equivalente para resolverlo después
 * del hecho, a diferencia de `confirmBooking`) para poder armar el
 * redirect final a `/me` sin una consulta extra.
 */
export async function confirmDynamicBooking(
  slotOccurrenceId: string,
  organizationSlug: string,
  _prev: BookingActionState,
): Promise<BookingActionState> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("book_dynamic_slot", {
    p_slot_occurrence_id: slotOccurrenceId,
  });

  if (error) {
    return { error: "No se pudo completar la reserva" };
  }

  const status = (data as { status: string }).status;
  if (status !== "OK") {
    return { error: BOOKING_REASONS[status] ?? "No se pudo completar la reserva" };
  }

  revalidatePath("/me");
  redirect(`/me?reservado=1&org=${encodeURIComponent(organizationSlug)}`);
}

/**
 * Libera el hold propio antes de que venza (p.ej. el cliente quiere elegir
 * otro horario). No-op silencioso si no es propio o ya no existe -- el
 * backend ya lo trata así, esto sólo lo refleja.
 */
export async function releaseDynamicHold(slotOccurrenceId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("release_dynamic_hold", { p_slot_occurrence_id: slotOccurrenceId });
}
