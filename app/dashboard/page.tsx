import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyOrganizations } from "@/app/actions/organizations";
import { signOut } from "@/app/actions/auth";
import { isCustomerSomewhere } from "@/app/actions/customer";
import { Button, buttonVariants } from "@/components/ui/button";
import { Brand } from "@/components/brand";
import { roleLabel } from "@/lib/labels";
import { cityForTimezone } from "@/lib/timezones";

export const metadata = { title: "Inicio" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const organizations = await getMyOrganizations();

  if (organizations.length === 0) {
    // Already somebody's customer -> the portal is plainly the right door.
    if (await isCustomerSomewhere()) {
      redirect("/me");
    }

    // Neither a member nor a customer. Signing in with Google says
    // nothing about *why* someone is here, and assuming "you must want to
    // create a business" was wrong for anyone who just came to book a
    // class. Ask instead of guessing.
    return (
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-6 px-5 py-10">
        <Brand href="/dashboard" />

        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl">¿Qué querés hacer?</h1>
          <p className="text-sm text-muted-foreground">
            Tu cuenta ya está lista. Elegí por dónde empezar.
          </p>
        </div>

        <div className="flex w-full flex-col gap-3">
          <div className="flex flex-col gap-2 rounded-xl border bg-card p-5 shadow-card">
            <h2 className="text-base">Reservar en un negocio</h2>
            <p className="text-sm text-muted-foreground">
              Entrá con el link que te pasó el negocio (por ejemplo reservaste.app/su-nombre). Para
              poder reservar, primero tienen que habilitarte como cliente.
            </p>
            <Link
              href="/me"
              className={buttonVariants({ variant: "outline", size: "sm", className: "self-start" })}
            >
              Ver mis reservas
            </Link>
          </div>

          <div className="flex flex-col gap-2 rounded-xl border bg-card p-5 shadow-card">
            <h2 className="text-base">Administrar mi negocio</h2>
            <p className="text-sm text-muted-foreground">
              Publicá tus horarios, controlá los cupos y dejá que tus clientes reserven solos.
            </p>
            <Link href="/onboarding" className={buttonVariants({ size: "sm", className: "self-start" })}>
              Crear mi organización
            </Link>
          </div>
        </div>

        <form action={signOut}>
          <Button type="submit" variant="ghost" size="sm">
            Salir
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-2 px-5 py-3">
          <Brand href="/dashboard" />
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm">
              Salir
            </Button>
          </form>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-5 py-6">
        <h1 className="text-xl">Tus organizaciones</h1>

        <div className="flex flex-col gap-2">
          {organizations.map(({ organization, membership }) => (
            <Link
              key={organization.id}
              href={`/org/${organization.slug}`}
              className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3.5 shadow-card transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-raised"
            >
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{organization.name}</span>
                <span className="truncate text-sm text-muted-foreground">
                  {roleLabel(membership.role)} · {cityForTimezone(organization.timezone)}
                </span>
              </div>
              <svg viewBox="0 0 24 24" fill="none" className="size-4 shrink-0 text-muted-foreground">
                <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          ))}
        </div>

        <Link
          href="/me"
          className="text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          Ver mis reservas como cliente
        </Link>
      </div>
    </div>
  );
}
