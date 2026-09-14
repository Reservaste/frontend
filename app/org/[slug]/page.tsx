import Link from "next/link";
import { requireOrganizationMembership } from "@/app/actions/organizations";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function OrganizationHomePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { organization, membership } = await requireOrganizationMembership(slug);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">{organization.name}</h1>
        <p className="text-sm text-muted-foreground">
          rol: {membership.role} · zona horaria: {organization.timezone}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link href={`/org/${slug}/services`}>
          <Card className="transition-colors hover:bg-muted">
            <CardHeader>
              <CardTitle>Servicios</CardTitle>
              <CardDescription>Lo que tu negocio ofrece</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href={`/org/${slug}/resources`}>
          <Card className="transition-colors hover:bg-muted">
            <CardHeader>
              <CardTitle>Recursos</CardTitle>
              <CardDescription>Salas, profesionales, equipos</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
}
