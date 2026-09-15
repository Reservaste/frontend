"use server";

import { redirect } from "next/navigation";
import { signInSchema, signUpSchema } from "@reservaste/domain";
import { createClient } from "@/lib/supabase/server";
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

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
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

  // Someone who signed up mid-booking goes back to finish it; someone who
  // came to set up a business lands on onboarding (ADR-0015).
  redirect(safeReturnTo(String(formData.get("returnTo") ?? ""), "/onboarding"));
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
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
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
