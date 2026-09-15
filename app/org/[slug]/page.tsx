import Link from "next/link";
import { requireOrganizationMembership } from "@/app/actions/organizations";
import { getAgenda, getCustomers } from "@/app/actions/admin";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { OccupancyBar } from "@/components/status";
import { buttonVariants } from "@/components/ui/button";
import { cityForTimezone } from "@/lib/timezones";

export const metadata = { title: "Inicio" };

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border bg-card px-4 py-3.5 shadow-card">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="tnum text-2xl font-semibold leading-none">{value}</span>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

export default async function OrganizationHomePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { organization } = await requireOrganizationMembership(slug);

  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const [upcoming, customers] = await Promise.all([getAgenda(slug, now, in24h), getCustomers(slug)]);

  const timeFormatter = new Intl.DateTimeFormat("es-UY", {
    timeZone: organization.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const seatsTaken = upcoming.reduce((sum, o) => sum + o.confirmedCount, 0);
  const seatsTotal = upcoming.reduce((sum, o) => sum + o.capacity, 0);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-5 py-6">
      <PageHeader
        title={organization.name}
        description={cityForTimezone(organization.timezone)}
        actions={
          <Link href={`/org/${slug}/agenda`} className={buttonVariants({ size: "sm" })}>
            Ir a la agenda
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Turnos hoy" value={String(upcoming.length)} hint="próximas 24 horas" />
        <Stat
          label="Lugares tomados"
          value={seatsTotal > 0 ? `${seatsTaken}/${seatsTotal}` : "—"}
          hint={seatsTotal > 0 ? `${seatsTotal - seatsTaken} disponibles` : "sin turnos"}
        />
        <Stat
          label="Clientes"
          value={String(customers.filter((c) => c.isActive).length)}
          hint="habilitados"
        />
      </div>

      <section className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Próximas 24 horas</h2>
          <Link
            href={`/org/${slug}/agenda`}
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Ver todo
          </Link>
        </div>

        {upcoming.length === 0 ? (
          <EmptyState
            title="No hay turnos próximos"
            description="Cargá un servicio y su horario para que empiecen a generarse."
            action={
              <Link href={`/org/${slug}/services`} className={buttonVariants({ size: "sm" })}>
                Cargar servicio
              </Link>
            }
          />
        ) : (
          <ul className="flex flex-col divide-y overflow-hidden rounded-xl border bg-card shadow-card">
            {upcoming.slice(0, 8).map((occ) => (
              <li key={occ.id} className="flex items-center gap-4 px-4 py-3">
                <span className="tnum min-w-12 text-base font-semibold">
                  {timeFormatter.format(new Date(occ.startAt))}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate text-sm font-medium">{occ.serviceName}</span>
                  <OccupancyBar confirmed={occ.confirmedCount} capacity={occ.capacity} className="max-w-40" />
                </div>
                <span className="tnum text-sm text-muted-foreground">
                  {occ.confirmedCount}/{occ.capacity}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        {[
          { href: `/org/${slug}/customers`, title: "Clientes", body: "Habilitar servicios y registrar pagos" },
          { href: `/org/${slug}/services`, title: "Servicios y horarios", body: "Lo que ofrecés y cuándo" },
          { href: `/org/${slug}/resources`, title: "Recursos", body: "Salas, profesionales, equipos" },
          { href: `/${organization.slug}`, title: "Página pública", body: "Lo que ve alguien sin cuenta" },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col gap-1 rounded-xl border bg-card px-4 py-3.5 shadow-card transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-raised"
          >
            <span className="font-medium">{item.title}</span>
            <span className="text-sm text-muted-foreground">{item.body}</span>
          </Link>
        ))}
      </section>
    </div>
  );
}
