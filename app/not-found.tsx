import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Brand } from "@/components/brand";

export const metadata = { title: "Página no encontrada" };

/**
 * App-level 404. Next's own default (a blank page with no way out) is
 * exactly the "callejón sin salida" `architecture.md` § Navegación rules
 * out -- this replaces it everywhere a route doesn't match, public, portal
 * or admin, since a not-found route has no `organizationSlug`/session
 * context to route the exit any more precisely than "start over". `/`
 * itself already redirects a signed-in user to `/dashboard`, so "Ir al
 * inicio" lands a logged-in owner back in their own panel instead of the
 * marketing page.
 */
export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-5 py-10 text-center">
      <Brand />
      <div className="flex flex-col items-center gap-2">
        <span className="eyebrow text-muted-foreground">Error 404</span>
        <h1 className="text-xl">No encontramos esta página</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          El link puede estar roto o la página puede haberse movido.
        </p>
      </div>
      <Link href="/" className={buttonVariants({ size: "touch" })}>
        Ir al inicio
      </Link>
    </div>
  );
}
