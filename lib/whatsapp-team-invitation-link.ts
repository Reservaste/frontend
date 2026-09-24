/**
 * ADR-0034: WhatsApp deep link for a team invitation. Deliberately not
 * `buildWhatsAppActivationLink()`: the message says something else ("te
 * invita a sumarse al equipo", not "a activar tu cuenta para gestionar tus
 * reservas") and the link points at another path (`/equipo/...`).
 *
 * The message names the **organization**, never the invited person --
 * neither their name nor their email (docs/security.md, Fase 33). Sending it
 * to a mistyped number must not leak a stranger's identity, and naming the
 * email would hand the wrong recipient the second factor the redemption
 * relies on.
 *
 * The token rides in `text=` -- unavoidable with the "the owner sends it
 * from their own WhatsApp" design; the 24h TTL and single use are what
 * contain that risk (ADR-0034, riesgo residual 2).
 */
export function buildWhatsAppTeamInvitationLink(params: {
  /** E.164 with leading "+", as normalized by `issue_team_invitation()`. */
  phone: string;
  organizationName: string;
  invitationUrl: string;
}): string {
  const digits = params.phone.replace(/[^0-9]/g, "");
  const message = `Hola! ${params.organizationName} te invita a sumarte a su equipo en Reservaste. El link vence en 24 horas: ${params.invitationUrl}`;
  const query = new URLSearchParams({ phone: digits, text: message });
  return `https://api.whatsapp.com/send?${query.toString()}`;
}
