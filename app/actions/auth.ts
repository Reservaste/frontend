"use server";

import { redirect } from "next/navigation";
import { signInSchema, signUpSchema } from "@reservaste/domain";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/site-url";
import { safeReturnTo } from "@/lib/return-to";

export interface AuthActionState {
  error: string | null;
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

  // ADR-0043 (corrección post-review de seguridad, punto 5): con
  // [auth.captcha] habilitado, GoTrue exige captcha_token en /signup --
  // sin token no vale la pena ni llamar a Supabase, el widget en el
  // formulario ya debería haber puesto uno acá antes de que el botón de
  // submit se habilite.
  const captchaToken = String(formData.get("captchaToken") ?? "");
  if (!captchaToken) {
    return { error: "Completá la verificación anti-spam antes de continuar." };
  }

  const returnTo = safeReturnTo(String(formData.get("returnTo") ?? ""));

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      captchaToken,
    },
  });

  if (error) {
    // ADR-0043 (corrección post-review de seguridad, punto 5): Supabase
    // devuelve "User already registered" en inglés para este caso, que
    // además permite enumerar emails ya registrados con solo probar un
    // signUp() por cada uno. Mismo criterio que signInWithPassword() más
    // abajo ("Email o contraseña incorrectos"): un mensaje que ni confirma
    // ni niega. Se compara el código, no el texto en inglés, porque
    // supabase-js lo expone en error.code además de en error.message.
    if (error.code === "user_already_exists" || error.message.toLowerCase().includes("already registered")) {
      return {
        error:
          "No pudimos crear la cuenta con esos datos. Si ya tenés una cuenta con ese email, iniciá sesión en vez de registrarte.",
      };
    }
    // Turnstile tokens expiran en minutos: alguien que tarda en completar
    // el resto del formulario puede llegar a submit con un token vencido
    // que el widget todavía no reemplazó. GoTrue rechaza esto como error
    // de captcha, no como credenciales inválidas.
    if (error.message.toLowerCase().includes("captcha")) {
      return {
        error:
          "La verificación anti-spam expiró o no pudo validarse. Recargá la página e intentá de nuevo.",
      };
    }
    return { error: error.message };
  }

  // ADR-0043: "Confirm email" is disabled, so signUp() always returns a
  // session immediately -- no email is sent, so there is nothing to wait
  // for. Redirect straight through, same as any other successful sign-in.
  //
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

  // ADR-0043 (corrección post-review de seguridad, punto 5): hallazgo
  // confirmado en vivo por backend-engineer -- GoTrue exige captcha_token
  // tanto en /signup como en /token?grant_type=password. Sin esto, con
  // [auth.captcha] habilitado, todo login por contraseña se rompe, no
  // sólo el alta de cuentas.
  const captchaToken = String(formData.get("captchaToken") ?? "");
  if (!captchaToken) {
    return { error: "Completá la verificación anti-spam antes de continuar." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    ...parsed.data,
    options: { captchaToken },
  });

  if (error) {
    // Supabase returns the same shape for several distinct situations;
    // collapsing them all into "wrong password" sends people to reset a
    // password that was never the problem.
    const message = error.message.toLowerCase();
    if (message.includes("not confirmed")) {
      // ADR-0043 (base) deshabilitó "Confirm email" del todo -- desde esa
      // fecha, signUp() nunca deja una cuenta sin confirmar, así que este
      // mensaje ya no le puede pasar a nadie que se registre de ahora en
      // más. Sigue aplicando sólo a cuentas viejas, previas al cambio,
      // hasta que se complete la auditoría de producción descripta en la
      // corrección post-review de esa ADR (punto 3) -- por eso el texto ya
      // no promete un email de confirmación que no se va a mandar.
      return {
        error:
          "Tu cuenta quedó en un estado anterior sin confirmar. No te va a llegar ningún email: escribile al negocio para que la reactive.",
      };
    }
    if (message.includes("captcha")) {
      // Same expiry window as signUp() above -- a token that went stale
      // while someone typed their password.
      return {
        error:
          "La verificación anti-spam expiró o no pudo validarse. Recargá la página e intentá de nuevo.",
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
