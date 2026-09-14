import Link from "next/link";
import { requireOrganizationMembership } from "@/app/actions/organizations";
import { getAgenda } from "@/app/actions/admin";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function OrganizationHomePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { organization, membership } = await requireOrganizationMembership(slug);

  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const upcoming = await getAgenda(slug, now, in24h);

  const timeFormatter = new Intl.DateTimeFormat("es-UY", {
    timeZone: organization.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-semibold">{organization.name}</h1>
        <p className="text-sm text-muted-foreground">
          rol: {membership.role} · zona horaria: {organization.timezone}
        </p>
      </div>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">Próximas 24 horas</h2>
          <Link href={`/org/${slug}/agenda`} className="text-sm underline underline-offset-4">
            Ver agenda
          </Link>
        </div>

        {upcoming.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No hay turnos en las próximas 24 horas.
          </p>
        ) : (
          <div className="flex flex-col gap-1 text-sm">
            {upcoming.slice(0, 8).map((occ) => (
              <div key={occ.id} className="flex items-center justify-between rounded border px-3 py-2">
                <span className="tabular-nums">
                  {timeFormatter.format(new Date(occ.startAt))} · {occ.serviceName}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {occ.confirmedCount} / {occ.capacity}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <Link href={`/org/${slug}/customers`}>
          <Card className="transition-colors hover:bg-muted">
            <CardHeader>
              <CardTitle>Clientes</CardTitle>
              <CardDescription>Habilitar servicios y registrar pagos</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href={`/org/${slug}/services`}>
          <Card className="transition-colors hover:bg-muted">
            <CardHeader>
              <CardTitle>Servicios</CardTitle>
              <CardDescription>Lo que ofrece el negocio y sus horarios</CardDescription>
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
        <Link href={`/${organization.slug}`}>
          <Card className="transition-colors hover:bg-muted">
            <CardHeader>
              <CardTitle>Página pública</CardTitle>
              <CardDescription>Lo que ve alguien sin cuenta</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </section>
    </div>
  );
}
