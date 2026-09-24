"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { organizationPath } from "@/lib/organization-path";
import {
  ACTIVATION_COOKIE_NAME as COOKIE_NAME,
  activationCookieClearOptions,
} from "@/lib/activation-cookie";

// The server-component reader of this cookie lives in `@/lib/server-cookies`,
// NOT here: every export of a "use server" module is an invocable action,
// and one that returns the token would hand an httpOnly secret to any
// same-origin script.

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
    // No es que el link haya vencido: es que este navegador no tiene el
    // token (lo abrió en otro, o limpió sus cookies). El link de WhatsApp
    // sigue sirviendo -- decirle "venció" lo manda a pedir uno nuevo que
    // tampoco va a hacer falta.
    return {
      error:
        "No encontramos la invitación en este navegador. Volvé a abrir el link de WhatsApp desde este mismo teléfono y seguí desde ahí.",
    };
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

  // Con el path explícito: `jar.delete(name)` borra la cookie de path "/",
  // que es otra cookie distinta de ésta -- el token sobrevivía a su propia
  // activación en vez de desaparecer.
  jar.set(COOKIE_NAME, "", activationCookieClearOptions());

  // Feedback de producción ("cuando me invitan como usuario no veo la
  // agenda como para comprar o reservar"): esto mandaba a /me, que para
  // alguien recién activado está necesariamente vacío -- todavía no tiene
  // ninguna reserva -- y no tiene un solo link a la agenda del negocio que
  // lo acaba de invitar. El nombre de la organización aparece en /me
  // recién cuando ya existe una reserva, así que el flujo terminaba en un
  // callejón sin salida: la persona hizo todo bien y quedó mirando "no
  // tenés reservas".
  //
  // La activación ES la invitación de un negocio puntual, y la RPC
  // devuelve exactamente cuál (`organization_slug`, resuelto adentro desde
  // el token -- el caller nunca lo elige). Esa página pública es su agenda
  // (ADR-0023), o sea el lugar donde la persona puede hacer lo único que
  // vino a hacer. Perder ese contexto para caer en un portal genérico era
  // tirar el único dato que hacía falta.
  const destination = organizationPath(result.organization_slug);
  redirect(destination ? `${destination}?activado=1` : "/me");
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
