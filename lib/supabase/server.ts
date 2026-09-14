import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server-side Supabase client, for Server Components, Server Actions and
 * Route Handlers. Reads/writes the session via Next.js cookies -- the
 * `setAll` call throws when invoked from a Server Component (cookies are
 * read-only there); that's expected and safe to swallow because
 * middleware.ts is what actually refreshes the session cookie.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component -- middleware.ts refreshes the session instead.
          }
        },
      },
    },
  );
}
