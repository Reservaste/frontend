"use server";

// Public, anonymous action for the /contacto landing form (ADR-0030,
// resolution 2). Deliberately separate from app/actions/platform.ts: every
// function in that file is gated by is_platform_admin() in SQL and reads
// existing platform data; this one is the opposite shape -- no auth check
// at all, by design, and it only writes a lead. The real defence against a
// malformed/abusive submission is submit_platform_contact_request() in
// backend/supabase/migrations (validation + rate limiting), not this file
// -- Zod here is edge validation for a better error message, same as the
// rest of app/actions/*.
//
// One extra layer lives here (see lib/rate-limit.ts): the RPC's rate limit
// is per `origin_ip` as Supabase sees it, which for this relayed call is
// always the droplet's own IP (ADR-0021) -- shared by every legitimate
// visitor. A per-visitor limit, checked with the real IP Next.js sees
// before we even call the RPC, keeps one visitor from exhausting that
// shared bucket for everyone else.

import { submitContactRequestSchema } from "@reservaste/domain";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, getVisitorIp } from "@/lib/rate-limit";

// Generous enough that a real visitor retrying a typo'd email never hits
// it, tight enough to stop a script: 4 submits per 15 minutes per visitor.
const CONTACT_RATE_LIMIT = 4;
const CONTACT_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

export interface ContactActionState {
  error: string | null;
  success: boolean;
}

export async function submitContactRequest(
  _prevState: ContactActionState,
  formData: FormData,
): Promise<ContactActionState> {
  const parsed = submitContactRequestSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    message: formData.get("message"),
    phone: formData.get("phone") ?? "",
    businessType: formData.get("businessType") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos", success: false };
  }

  // Skip the local limit entirely when the visitor can't be identified
  // (no forwarded-IP header at all) rather than blocking them -- the RPC's
  // own per-origin limit still applies as a backstop either way.
  const visitorIp = await getVisitorIp();
  if (visitorIp) {
    const { allowed } = checkRateLimit(
      `contact:${visitorIp}`,
      CONTACT_RATE_LIMIT,
      CONTACT_RATE_LIMIT_WINDOW_MS,
    );
    if (!allowed) {
      return {
        error: "Recibimos muchos mensajes en este momento. Probá de nuevo en un rato, o escribinos directamente.",
        success: false,
      };
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_platform_contact_request", {
    p_name: parsed.data.name,
    p_email: parsed.data.email,
    p_message: parsed.data.message,
    p_phone: parsed.data.phone || null,
    p_business_type: parsed.data.businessType || null,
  });

  if (error) {
    if (error.message.includes("RATE_LIMITED")) {
      return {
        error: "Recibimos muchos mensajes en este momento. Probá de nuevo en un rato, o escribinos directamente.",
        success: false,
      };
    }
    if (error.message.includes("INVALID_EMAIL")) {
      return { error: "Revisá el formato del email.", success: false };
    }
    if (error.message.includes("INVALID_NAME")) {
      return { error: "Contanos tu nombre.", success: false };
    }
    if (error.message.includes("INVALID_MESSAGE")) {
      return { error: "Contanos brevemente qué necesitás.", success: false };
    }
    if (error.message.includes("INVALID_PHONE")) {
      return { error: "Revisá el formato del teléfono.", success: false };
    }
    if (error.message.includes("INVALID_BUSINESS_TYPE")) {
      return { error: "Ese campo es demasiado largo.", success: false };
    }
    return { error: "No pudimos enviar tu mensaje. Intentá de nuevo.", success: false };
  }

  return { error: null, success: true };
}
