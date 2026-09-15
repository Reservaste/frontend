import Link from "next/link";
import { getMyOrganizations, requireOrganizationMembership } from "@/app/actions/organizations";
import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand";
import { OrgNav } from "@/components/org-nav";

export default async function OrganizationLayout({ children, params }: LayoutProps<"/org/[slug]">) {
  const { slug } = await params;
  const [{ organization }, organizations] = await Promise.all([
    requireOrganizationMembership(slug),
    getMyOrganizations(),
  ]);

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {/* Was a bare mark, which made this a dead end: once inside an
                organization there was no way back to the list of them
                except editing the URL. */}
            <Link
              href="/dashboard"
              title="Volver a tus organizaciones"
              aria-label="Volver a tus organizaciones"
              className="rounded-lg transition-opacity hover:opacity-80"
            >
              <BrandMark />
            </Link>
            <div className="flex min-w-0 flex-col">
              <Link href={`/org/${slug}`} className="truncate text-sm font-semibold hover:underline">
                {organization.name}
              </Link>
              {/* Switching only means something to someone who has more
                  than one, so it only shows up for them. */}
              {organizations.length > 1 ? (
                <Link
                  href="/dashboard"
                  className="text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
                >
                  Cambiar organización
                </Link>
              ) : (
                <span className="text-xs text-muted-foreground">/{organization.slug}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Link
              href={`/${organization.slug}`}
              className="rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Ver página pública
            </Link>
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="sm">
                Salir
              </Button>
            </form>
          </div>
        </div>
        <OrgNav slug={slug} />
      </header>

      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
