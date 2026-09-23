"use server";

import { redirect } from "next/navigation";
import { signInSchema, signUpSchema } from "@reservaste/domain";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/site-url";
import { safeReturnTo } from "@/lib/return-to";

export interface AuthActionState {
  error: string | null;
  /** Not a failure: e.g. the account was created but needs email confirmation. */
  notice?: string | null;
}

export async function signUpWithPassword(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    fullName: formData.get("fullName"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const returnTo = safeReturnTo(String(formData.get("returnTo") ?? ""));

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      // Sin esto el link de confirmación cae en la Site URL del proyecto
      // (la home) y la intención con la que la persona se registró se
      // pierde justo ahí. Para la activación de ADR-0026 eso era fatal:
      // el cliente gestionado se registra *para* activar, confirma por
      // mail, y volvía a la home -- nunca a /activar/continuar, que es la
      // única pantalla donde el link de WhatsApp se puede canjear. Misma
      // forma que el `redirectTo` de Google acá abajo, así que la URL ya
      // está en el allowlist de Supabase Auth.
      emailRedirectTo: `${siteUrl()}/auth/callback?next=${encodeURIComponent(returnTo)}`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  // With "Confirm email" enabled, signUp creates the user but no session.
  // Redirecting as if they were signed in would bounce them straight back
  // to /login with no explanation -- which is exactly how this looked
  // like a wrong-password problem the first time it happened.
  if (!data.session) {
    return {
      error: null,
      notice:
        "Creamos tu cuenta. Revisá tu email para confirmarla antes de ingresar (mirá también el spam).",
    };
  }

  // Someone who signed up mid-booking goes back to finish it (ADR-0015).
  //
  // Sin `returnTo` el default era `/onboarding`, o sea "creá tu negocio":
  // la misma puerta equivocada que la Fase 9 ya había sacado de
  // `/dashboard` ("mandaba a cualquiera sin organización a 'creá tu
  // negocio' — la puerta equivocada para un cliente"), sobreviviendo acá.
  // Hoy el formulario de /signup siempre manda un `returnTo`, así que esto
  // es una trampa latente más que un bug en vivo, pero el default de
  // "intención desconocida" tiene que ser el mismo en las dos puertas:
  // `/dashboard`, que pregunta en vez de adivinar (y donde "Crear mi
  // organización" sigue estando a un tap).
  redirect(returnTo);
}

export async function signInWithPassword(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    // Supabase returns the same shape for several distinct situations;
    // collapsing them all into "wrong password" sends people to reset a
    // password that was never the problem.
    const message = error.message.toLowerCase();
    if (message.includes("not confirmed")) {
      return {
        error:
          "Tu cuenta todavía no está confirmada. Buscá el email de confirmación (revisá el spam) o pedile al negocio que la active.",
      };
    }
    if (message.includes("rate limit") || error.status === 429) {
      return { error: "Demasiados intentos seguidos. Esperá un momento y probá de nuevo." };
    }
    return { error: "Email o contraseña incorrectos" };
  }

  redirect(safeReturnTo(String(formData.get("returnTo") ?? "")));
}

export async function signInWithGoogle(formData: FormData) {
  const supabase = await createClient();
  const origin = siteUrl();
  const next = safeReturnTo(String(formData.get("returnTo") ?? ""));

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error || !data.url) {
    redirect("/login?error=No se pudo iniciar sesión con Google");
  }

  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
