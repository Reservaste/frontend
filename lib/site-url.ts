/**
 * The app's own public origin.
 *
 * Deliberately NOT derived from the incoming request. Behind a reverse
 * proxy the server sees its internal bind address, so
 * `new URL(request.url).origin` resolves to `https://0.0.0.0:3000` --
 * which browsers treat as localhost. That is not a cosmetic slip: it is
 * where OAuth drops the user after a successful login, so the session is
 * created and then the redirect lands nowhere.
 *
 * Any absolute URL we hand to an external service (Supabase Auth's
 * redirectTo) or send back as a redirect has to come from here.
 */
export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;

  if (configured) {
    // A trailing slash would produce "https://host//auth/callback", which
    // some allowlists compare literally and reject.
    return configured.replace(/\/+$/, "");
  }

  if (process.env.NODE_ENV === "production") {
    // Falling back to localhost in production is what let the bug above
    // stay invisible: logins half-worked instead of failing loudly.
    throw new Error(
      "NEXT_PUBLIC_SITE_URL no está configurada. Sin eso el login con Google redirige a un host equivocado.",
    );
  }

  return "http://localhost:3000";
}
