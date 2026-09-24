import type { TeamInvitationStatus } from "@reservaste/domain";

/**
 * ADR-0034: how an invitation's derived status reads to the owner. The
 * status itself comes from `organization_team_invitations()` -- this never
 * re-derives it from the dates, it only words it.
 *
 * `EXPIRED` is a warning, not an error: nobody did anything wrong, the link
 * simply ran out, and it is exactly the one to re-send.
 */
export const TEAM_INVITATION_STATUS: Record<
  TeamInvitationStatus,
  { label: string; tone: "warning" | "neutral" | "success" | "primary" }
> = {
  PENDING: { label: "Enviada", tone: "primary" },
  EXPIRED: { label: "Vencida", tone: "warning" },
  REVOKED: { label: "Cancelada", tone: "neutral" },
  REDEEMED: { label: "Activada", tone: "success" },
};

/** Whether the owner can still act on it (re-send / revoke). */
export function isOpenInvitation(status: TeamInvitationStatus): boolean {
  return status === "PENDING" || status === "EXPIRED";
}

/**
 * "vence en 5 h" / "vence en menos de 1 h", for a PENDING invitation. `now`
 * is passed in so the server renders it once and the client never
 * disagrees with it during hydration.
 */
export function expiresInLabel(expiresAt: string, now: number): string {
  const ms = new Date(expiresAt).getTime() - now;
  if (ms <= 0) return "vencida";
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (hours < 1) return "vence en menos de 1 h";
  return `vence en ${hours} h`;
}
