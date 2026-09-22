"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const COOKIE_NAME = "activation_token";

/** Server component helper: is there a live activation token in flight? */
export async function readActivationToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(COOKIE_NAME)?.value ?? null;
}

const ERROR_MESSAGES: Record<string, string> = {
  AUTH_REQUIRED: "Iniciá sesión para continuar.",
  INVALID_TOKEN: "Este link no es válido. Pedile al negocio que te lo reenvíe.",
  ACTIVATION_REVOKED: "Este link fue desactivado. Pedile al negocio que te mande uno nuevo.",
  ALREADY_REDEEMED: "Este link ya fue usado por otra cuenta. Pedile al negocio que te reenvíe uno nuevo.",
  ACTIVATION_EXPIRED: "Este link venció. Pedile al negocio que te lo reenvíe.",
  CUSTOMER_UNAVAILABLE: "Esta invitación ya no está disponible.",
  ALREADY_CUSTOMER_OF_ORGANIZATION:
    "Ya tenés una cuenta propia como cliente de este negocio. Avisale al negocio para que junte ambas fichas.",
  ALREADY_CLAIMED: "Este link ya fue usado.",
};

export interface ClaimActivationState {
  error: string | null;
}

/**
 * ADR-0026 Sec 2.4: the RPC receives only the token -- read from the
 * httpOnly cookie set by the route handler, never from a form field or a
 * URL the client could tamper with. Nothing here names a customer row;
 * the identity is auth.uid() and the destination is whatever the token
 * resolves to, entirely inside the database function.
 */
export async function claimActivation(): Promise<ClaimActivationState> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;

  if (!token) {
    return { error: "Este link ya no es válido. Pedile al negocio que te lo reenvíe." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Iniciá sesión para continuar." };
  }

  const { data, error } = await supabase.rpc("claim_customer_activation", { p_token: token });

  if (error) {
    const code = Object.keys(ERROR_MESSAGES).find((key) => error.message.includes(key));
    return { error: code ? ERROR_MESSAGES[code] : "No se pudo completar la activación." };
  }

  const result = data as { status: string; organization_slug: string };
  if (result?.status !== "OK") {
    return { error: "No se pudo completar la activación." };
  }

  jar.delete(COOKIE_NAME);
  redirect("/me?activado=1");
}

/**
 * "No soy yo" on the confirmation screen (ADR-0026 Sec 2.4's most common
 * case: a shared phone, or someone opening the link "to see how it
 * looks"). Signs out and sends the person back to the same activation
 * flow -- the cookie is untouched by sign-out, so the token survives the
 * round trip through /login.
 */
export async function signOutForActivation(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login?returnTo=%2Factivar%2Fcontinuar");
}
