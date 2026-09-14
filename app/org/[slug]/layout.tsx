import Link from "next/link";
import { requireOrganizationMembership } from "@/app/actions/organizations";
import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "", label: "Inicio" },
  { href: "/agenda", label: "Agenda" },
  { href: "/customers", label: "Clientes" },
  { href: "/services", label: "Servicios" },
  { href: "/resources", label: "Recursos" },
  { href: "/team", label: "Equipo" },
  { href: "/settings", label: "Configuración" },
];

export default async function OrganizationLayout({ children, params }: LayoutProps<"/org/[slug]">) {
  const { slug } = await params;
  const { organization } = await requireOrganizationMembership(slug);

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <Link href={`/org/${slug}`} className="text-sm font-semibold">
            {organization.name}
          </Link>
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="xs">
              Cerrar sesión
            </Button>
          </form>
        </div>
        <nav className="mx-auto w-full max-w-5xl overflow-x-auto px-4 pb-2">
          <ul className="flex gap-1 text-sm">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={`/org/${slug}${item.href}`}
                  className="inline-block whitespace-nowrap rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
