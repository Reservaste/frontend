"use server";

import type { AuditAction, AuditLogCursor, AuditLogEntry } from "@reservaste/domain";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizationMembership } from "@/app/actions/organizations";

// ADR-0032 -- lectura del audit_log para el OWNER.
//
// `organization_audit_log()` es OWNER-only EN LA BASE (NOT_AUTHORIZED para
// STAFF y para el OWNER de otra organización), y enmascara al actor de
// plataforma: actorId/actorName null + actorIsPlatform true (resolución 2).
// Esta acción no resuelve ese actor a nada -- ni nombre ni uuid.
//
// El organizationId sale del slug + membership, como el resto de las
// acciones ADMIN: nunca un id de parámetro libre.

interface AuditLogRow {
  id: string;
  action: AuditAction;
  target_table: string;
  target_id: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_is_platform: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

function mapAuditLogRow(row: AuditLogRow): AuditLogEntry {
  return {
    id: row.id,
    action: row.action,
    targetTable: row.target_table,
    targetId: row.target_id,
    actorId: row.actor_id,
    actorName: row.actor_name,
    actorIsPlatform: row.actor_is_platform,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  };
}

export interface AuditLogResult {
  entries: AuditLogEntry[];
  /**
   * Non-null when the read failed or was refused. Kept apart from an empty
   * list on purpose: "no pasó nada" and "no pudimos leerlo" are different
   * answers, and the screen says "registro desde tal fecha" next to the
   * empty one.
   */
  error: string | null;
}

/**
 * The organization's audit log, newest first. `cursor` pages backwards by
 * the composite key `(created_at, id)` of the last row of the previous page
 * (the RPC orders by `created_at desc, id desc`) -- Fase 30b: `created_at`
 * alone lost rows silently when a single transaction (e.g. cancelling an
 * occurrence with several bookings) wrote several audit rows with the exact
 * same timestamp. `limit` is clamped to 1..200 in SQL anyway.
 *
 * Both halves of `cursor` must come verbatim from the previous RPC response
 * (never reconstructed with `Date`, never truncated) -- `created_at` has
 * microsecond precision and truncating moves the cursor before the real row.
 */
export async function getOrganizationAuditLog(
  organizationSlug: string,
  options?: { limit?: number; cursor?: AuditLogCursor },
): Promise<AuditLogResult> {
  const { organization, membership } = await requireOrganizationMembership(organizationSlug);

  if (membership.role !== "OWNER") {
    return { entries: [], error: "Sólo el dueño puede ver el registro de actividad." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("organization_audit_log", {
    p_organization_id: organization.id,
    p_limit: options?.limit ?? 50,
    p_before_created_at: options?.cursor?.beforeCreatedAt ?? null,
    p_before_id: options?.cursor?.beforeId ?? null,
  });

  if (error) {
    // INVALID_CURSOR: cursor a medias o corrupto (nunca debería pasar desde
    // esta misma acción, pero un cursor viejo en la URL del usuario -- p.ej.
    // un link guardado de antes de este cambio -- puede disparar esto). No es
    // el mismo caso que "no sos el dueño": volvemos a la primera página en
    // vez de mostrar el error de permisos.
    if (error.message.includes("INVALID_CURSOR")) {
      const { data: firstPage, error: firstPageError } = await supabase.rpc("organization_audit_log", {
        p_organization_id: organization.id,
        p_limit: options?.limit ?? 50,
        p_before_created_at: null,
        p_before_id: null,
      });

      if (!firstPageError) {
        return { entries: ((firstPage ?? []) as AuditLogRow[]).map(mapAuditLogRow), error: null };
      }
    }

    return {
      entries: [],
      error: error.message.includes("NOT_AUTHORIZED")
        ? "Sólo el dueño puede ver el registro de actividad."
        : "No pudimos cargar el registro. Probá de nuevo en un momento.",
    };
  }

  return { entries: ((data ?? []) as AuditLogRow[]).map(mapAuditLogRow), error: null };
}
