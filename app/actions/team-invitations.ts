"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  inviteTeamMemberSchema,
  mapOrganizationTeamInvitation,
  type OrganizationTeamInvitation,
  type OrganizationTeamInvitationRow,
} from "@reservaste/domain";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizationMembership } from "@/app/actions/organizations";
import type { ActionState } from "@/app/actions/admin";
import { siteUrl } from "@/lib/site-url";
import { buildWhatsAppTeamInvitationLink } from "@/lib/whatsapp-team-invitation-link";
import {
  TEAM_INVITATION_COOKIE_NAME,
  teamInvitationCookieClearOptions,
} from "@/lib/team-invitation-cookie";

// ADR-0034 -- invitaciones de equipo sin registro previo.
//
// Emitir, revocar y listar son OWNER-only EN LA BASE (las tres RPCs
// chequean is_organization_owner()). El `membership.role !== "OWNER"` de
// abajo sólo da un mensaje decente en vez de un error crudo.
//
// El token claro existe una sola vez, en el retorno de
// issue_team_invitation(). De acá sale SÓLO adentro de `whatsappUrl` /
// `invitationUrl`: nunca como campo suelto, nunca persistido, nunca logueado.

const OWNER_ONLY = "Solo el dueño puede invitar gente al equipo";

/** Errores de emisión/revocación, en términos de lo que el dueño puede hacer. */
function describeIssueError(message: string | undefined): string {
  if (!message) return "Algo salió mal";
  if (message.includes("NOT_AUTHORIZED")) return "No tenés permiso para hacer esto";
  if (message.includes("SUBSCRIPTION_INACTIVE")) return "La suscripción de la organización está suspendida";
  if (message.includes("EMAIL_REQUIRED") || message.includes("INVALID_EMAIL")) {
    return "Revisá el email: es el que la persona va a tener que usar para entrar";
  }
  if (message.includes("INVALID_PHONE")) {
    return "Revisá el teléfono: tiene que incluir el código de país (ej: +598 99 123 456)";
  }
  if (message.includes("ROLE_NOT_FOUND") || message.includes("ROLE_OTHER_ORGANIZATION")) {
    return "Ese rol ya no está disponible. Elegí otro";
  }
  if (message.includes("RATE_LIMITED")) {
    return "Mandaste muchas invitaciones seguidas. Probá de nuevo en un rato";
  }
  if (message.includes("PLAN_LIMIT_REACHED")) {
    // La diferencia con el error que ya existía: acá cuentan también las
    // invitaciones pendientes, y si el mensaje no lo dice el dueño cuenta
    // su equipo, ve que hay lugar y no entiende nada.
    return "Tu plan no tiene más lugares de equipo. Contá también las invitaciones pendientes: revocá una o cambiá de plan";
  }
  return "Algo salió mal";
}

export interface IssuedTeamInvitation {
  invitationId: string;
  expiresAt: string;
  /**
   * Deep link de api.whatsapp.com armado acá (nombre de la organización y
   * siteUrl() nunca desde el cliente). Null cuando la invitación no tiene
   * teléfono: entonces la UI ofrece sólo "copiar link".
   */
  whatsappUrl: string | null;
  /** El link pelado, para "copiar link". */
  invitationUrl: string;
}

export type IssueTeamInvitationState = ActionState & { invitation: IssuedTeamInvitation | null };

/**
 * Campos del FormData: `email`, `displayName`, `phone` (opcional), `roleId`
 * (vacío = rol por defecto). "Reenviar" es exactamente esta misma llamada
 * con los mismos datos: la RPC revoca el link vivo de ese email antes de
 * emitir el nuevo.
 */
export async function issueTeamInvitation(
  organizationSlug: string,
  _prev: IssueTeamInvitationState,
  formData: FormData,
): Promise<IssueTeamInvitationState> {
  const { organization, membership } = await requireOrganizationMembership(organizationSlug);
  if (membership.role !== "OWNER") {
    return { error: OWNER_ONLY, success: null, invitation: null };
  }

  const text = (key: string) => {
    const value = String(formData.get(key) ?? "").trim();
    return value === "" ? undefined : value;
  };

  // El schema normaliza el email (trim + minúsculas) igual que la RPC: si
  // el borde y la base normalizaran distinto, "reenviar" crearía una
  // segunda invitación viva en vez de reemplazar la primera.
  const parsed = inviteTeamMemberSchema.safeParse({
    organizationId: organization.id,
    email: text("email") ?? "",
    displayName: text("displayName"),
    phone: text("phone"),
    roleId: text("roleId") ?? null,
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Datos inválidos",
      success: null,
      invitation: null,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("issue_team_invitation", {
    p_organization_id: organization.id,
    p_email: parsed.data.email,
    p_display_name: parsed.data.displayName ?? null,
    p_phone: parsed.data.phone ?? null,
    p_role_id: parsed.data.roleId ?? null,
  });

  const row = (Array.isArray(data) ? data[0] : data) as
    | { invitation_id: string; token: string; expires_at: string }
    | undefined;

  if (error || !row) {
    return { error: describeIssueError(error?.message), success: null, invitation: null };
  }

  const invitationUrl = `${siteUrl()}/equipo/${row.token}`;

  // Si la RPC aceptó el teléfono, ya lo validó (INVALID_PHONE si no); el
  // builder se queda sólo con los dígitos, que es lo mismo que la base
  // guarda menos el "+". Sin teléfono no hay link de WhatsApp: sólo
  // "copiar link", y la invitación es igual de válida.
  const whatsappUrl = parsed.data.phone
    ? buildWhatsAppTeamInvitationLink({
        phone: parsed.data.phone,
        organizationName: organization.name,
        invitationUrl,
      })
    : null;

  revalidatePath(`/org/${organizationSlug}/team`);

  return {
    error: null,
    success: "Invitación lista",
    invitation: {
      invitationId: row.invitation_id,
      expiresAt: row.expires_at,
      whatsappUrl,
      invitationUrl,
    },
  };
}

export async function revokeTeamInvitation(
  organizationSlug: string,
  invitationId: string,
): Promise<ActionState> {
  const { membership } = await requireOrganizationMembership(organizationSlug);
  if (membership.role !== "OWNER") return { error: OWNER_ONLY, success: null };

  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_team_invitation", { p_invitation_id: invitationId });

  if (error) {
    return { error: describeIssueError(error.message), success: null };
  }

  revalidatePath(`/org/${organizationSlug}/team`);
  return { error: null, success: "Invitación cancelada: el link ya no funciona" };
}

/**
 * Las invitaciones de la organización. Para un no-OWNER la RPC devuelve
 * cero filas (no un error), así que esto nunca rompe una pantalla: la lista
 * queda vacía. `null` = no se pudo leer, para que la UI distinga "no hay"
 * de "falló".
 */
export async function getTeamInvitations(
  organizationSlug: string,
  includeHistory = false,
): Promise<OrganizationTeamInvitation[] | null> {
  const { organization, membership } = await requireOrganizationMembership(organizationSlug);
  if (membership.role !== "OWNER") return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("organization_team_invitations", {
    p_organization_id: organization.id,
    p_include_history: includeHistory,
  });

  if (error || !data) return null;
  return (data as OrganizationTeamInvitationRow[]).map(mapOrganizationTeamInvitation);
}

// ---------------------------------------------------------------
// El canje
// ---------------------------------------------------------------

// El lector de la cookie para server components vive en
// `@/lib/server-cookies`, NO acá: todo export de un módulo "use server" es
// una acción invocable, y una que devuelve el token le entrega un secreto
// httpOnly a cualquier script del mismo origen.

// Ninguno nombra el email ni el nombre de la invitación (docs/security.md,
// Fase 33): sólo el email de la SESIÓN, que la persona ya conoce.
const CLAIM_ERRORS: Record<string, string> = {
  AUTH_REQUIRED: "Iniciá sesión para continuar.",
  INVALID_TOKEN: "Este link no es válido. Pedile al negocio que te lo reenvíe.",
  INVITATION_REVOKED: "Este link fue desactivado. Pedile al negocio uno nuevo.",
  INVITATION_EXPIRED: "Este link venció (duran 24 horas). Pedile al negocio que te lo reenvíe.",
  ALREADY_REDEEMED: "Este link ya fue usado por otra cuenta. Pedile al negocio uno nuevo.",
  INVITATION_ROLE_UNAVAILABLE: "El rol de esta invitación ya no existe. Pedile al negocio que te la reenvíe.",
  ORGANIZATION_UNAVAILABLE: "Este negocio no está disponible en este momento.",
  PLAN_LIMIT_REACHED: "El equipo de este negocio está completo. Avisale al negocio.",
  SUBSCRIPTION_INACTIVE: "Este negocio no está disponible en este momento.",
};

export interface ClaimTeamInvitationState {
  error: string | null;
}

/**
 * El canje. La RPC recibe SÓLO el token, leído de la cookie httpOnly que
 * dejó `/equipo/[token]` -- nunca de un campo del formulario ni de la URL.
 * El destino sale entero del token; la identidad, entera de auth.uid().
 */
export async function claimTeamInvitation(): Promise<ClaimTeamInvitationState> {
  const jar = await cookies();
  const token = jar.get(TEAM_INVITATION_COOKIE_NAME)?.value;

  if (!token) {
    // No "venció": este navegador simplemente no tiene el token (mismo
    // arreglo que el hotfix de clientes del 2026-09-23).
    return {
      error:
        "No encontramos la invitación en este navegador. Volvé a abrir el link desde este mismo teléfono y seguí desde ahí.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Iniciá sesión para continuar." };
  }

  const { data, error } = await supabase.rpc("claim_team_invitation", { p_token: token });

  if (error) {
    if (error.message.includes("INVITE_WRONG_EMAIL")) {
      // El mensaje más importante del flujo: sin decir con qué email está
      // la sesión, la persona no puede entender qué salió mal (el caso
      // típico: entró con Google y su cuenta de Google es otra). NUNCA el
      // email de la invitación -- ése es el segundo factor.
      return {
        error: `Esta invitación es para otro email. Entrá con la casilla a la que te la mandaron, o pedile al negocio que te la reenvíe a ${user.email ?? "el email con el que entraste"}.`,
      };
    }
    const code = Object.keys(CLAIM_ERRORS).find((key) => error.message.includes(key));
    return { error: code ? CLAIM_ERRORS[code] : "No se pudo completar la invitación." };
  }

  const result = data as { status?: string; organization_slug?: string } | null;
  if (result?.status !== "OK" || !result.organization_slug) {
    return { error: "No se pudo completar la invitación." };
  }

  // Con el path explícito: `jar.delete(name)` apunta a la cookie de path
  // "/", que es otra distinta.
  jar.set(TEAM_INVITATION_COOKIE_NAME, "", teamInvitationCookieClearOptions());

  // Al panel del negocio al que se acaba de sumar, no a /dashboard: hizo
  // click para entrar a ÉSE.
  redirect(`/org/${encodeURIComponent(result.organization_slug)}`);
}

/**
 * "No soy yo / usar otra cuenta": cierra sesión y vuelve al mismo canje. La
 * cookie de equipo no se toca, así que el token sobrevive la vuelta por
 * /login.
 */
export async function signOutForTeamInvitation(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login?returnTo=%2Fequipo%2Fcontinuar");
}
