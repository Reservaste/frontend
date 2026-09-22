/**
 * ADR-0026 Sec 5.3: the WhatsApp deep link carries the activation token in
 * its own `text=` parameter -- there is no way to avoid that with the
 * "no Twilio, dueño lo manda desde su propio WhatsApp" design, so the
 * token's short TTL (72h) and single use are what actually contain the
 * risk, not this function.
 *
 * The message names the **organization**, never the customer: sending it
 * to a mistyped number must not leak a stranger's name (ADR-0026 Sec 3).
 */
export function buildWhatsAppActivationLink(params: {
  /** E.164 with leading "+", as stored on customers.phone. */
  phone: string;
  organizationName: string;
  activationUrl: string;
}): string {
  const digits = params.phone.replace(/[^0-9]/g, "");
  const message = `Hola! ${params.organizationName} te invita a activar tu cuenta para gestionar tus reservas. Entrá acá: ${params.activationUrl}`;
  const query = new URLSearchParams({ phone: digits, text: message });
  return `https://api.whatsapp.com/send?${query.toString()}`;
}
