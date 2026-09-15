import Link from "next/link";
import { requireOrganizationMembership } from "@/app/actions/organizations";
import { getAgenda, getCustomers, getOccurrenceAttendees } from "@/app/actions/admin";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { OccupancyBar, StatusBadge } from "@/components/status";
import { buttonVariants } from "@/components/ui/button";
import { OccurrenceActions } from "./occurrence-actions";

export const metadata = { title: "Agenda" };

type View = "day" | "week";

/**
 * Start of the given local day *in the organization's timezone*, returned
 * as a real instant. Everything the agenda queries is timestamptz, so the
 * range has to be built from the org's wall clock, not the server's --
 * otherwise a Montevideo gym on a US-hosted server would see the wrong
 * day's classes around midnight (ADR-0014).
 */
function startOfLocalDay(date: Date, timeZone: string): Date {
  const localDate = new Intl.DateTimeFormat("en-CA", { timeZone }).format(date);
  const probe = new Date(`${localDate}T00:00:00Z`);
  const asLocal = new Date(probe.toLocaleString("en-US", { timeZone }));
  const asUtc = new Date(probe.toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(probe.getTime() + (asUtc.getTime() - asLocal.getTime()));
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export default async function AgendaPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ view?: string; date?: string }>;
}) {
  const { slug } = await params;
  const { view: viewParam, date: dateParam } = await searchParams;
  const { organization } = await requireOrganizationMembership(slug);

  const view: View = viewParam === "week" ? "week" : "day";
  const anchor = dateParam ? new Date(`${dateParam}T12:00:00Z`) : new Date();

  const from = startOfLocalDay(anchor, organization.timezone);
  const to = addDays(from, view === "week" ? 7 : 1);

  const [occurrences, customers] = await Promise.all([getAgenda(slug, from, to), getCustomers(slug)]);
  const attendeesByOccurrence = await Promise.all(
    occurrences.map((occ) => getOccurrenceAttendees(slug, occ.id)),
  );

  const dayFormatter = new Intl.DateTimeFormat("es-UY", {
    timeZone: organization.timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const timeFormatter = new Intl.DateTimeFormat("es-UY", {
    timeZone: organization.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const isoFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: organization.timezone });

  const anchorIso = isoFormatter.format(anchor);
  const prevIso = isoFormatter.format(addDays(anchor, view === "week" ? -7 : -1));
  const nextIso = isoFormatter.format(addDays(anchor, view === "week" ? 7 : 1));
  const todayIso = isoFormatter.format(new Date());

  const groups = new Map<string, typeof occurrences>();
  for (const occ of occurrences) {
    const key = dayFormatter.format(new Date(occ.startAt));
    const list = groups.get(key) ?? [];
    list.push(occ);
    groups.set(key, list);
  }

  const totalConfirmed = occurrences.reduce((sum, o) => sum + o.confirmedCount, 0);
  const totalCapacity = occurrences.reduce((sum, o) => sum + o.capacity, 0);

  const navLink =
    "inline-flex size-8 items-center justify-center rounded-lg border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 px-5 py-6">
      <PageHeader
        title="Agenda"
        description={
          occurrences.length > 0
            ? `${occurrences.length} turnos · ${totalConfirmed} de ${totalCapacity} lugares tomados`
            : undefined
        }
        actions={
          <div className="flex items-center gap-1 rounded-lg border bg-card p-0.5">
            {(["day", "week"] as const).map((option) => (
              <Link
                key={option}
                href={`/org/${slug}/agenda?view=${option}&date=${anchorIso}`}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  view === option ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {option === "day" ? "Día" : "Semana"}
              </Link>
            ))}
          </div>
        }
      />

      <div className="flex items-center justify-between gap-2 rounded-xl border bg-card px-3 py-2 shadow-card">
        <Link href={`/org/${slug}/agenda?view=${view}&date=${prevIso}`} className={navLink} aria-label="Anterior">
          <svg viewBox="0 0 24 24" fill="none" className="size-4">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium capitalize">{dayFormatter.format(from)}</span>
          {anchorIso !== todayIso ? (
            <Link
              href={`/org/${slug}/agenda?view=${view}&date=${todayIso}`}
              className="rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary-subtle"
            >
              Hoy
            </Link>
          ) : null}
        </div>

        <Link href={`/org/${slug}/agenda?view=${view}&date=${nextIso}`} className={navLink} aria-label="Siguiente">
          <svg viewBox="0 0 24 24" fill="none" className="size-4">
            <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>

      {occurrences.length === 0 ? (
        <EmptyState
          title="No hay turnos en este período"
          description="Los turnos se generan solos a partir de los horarios que cargues en cada servicio."
          action={
            <Link href={`/org/${slug}/services`} className={buttonVariants({ size: "sm" })}>
              Configurar horarios
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-6">
          {[...groups.entries()].map(([day, dayOccurrences]) => (
            <section key={day} className="flex flex-col gap-2">
              {view === "week" ? (
                <h2 className="text-xs font-semibold uppercase tracking-wider capitalize text-muted-foreground">
                  {day}
                </h2>
              ) : null}

              {dayOccurrences.map((occ) => {
                const index = occurrences.indexOf(occ);
                const attendees = attendeesByOccurrence[index] ?? [];
                const available = occ.capacity - occ.confirmedCount;
                const isCancelled = occ.status === "CANCELLED";
                const isBlocked = occ.status === "BLOCKED";

                return (
                  <article
                    key={occ.id}
                    className={`overflow-hidden rounded-xl border bg-card shadow-card transition-opacity ${
                      isCancelled ? "opacity-60" : ""
                    }`}
                  >
                    <div className="flex flex-wrap items-start gap-4 px-4 py-3.5">
                      <div className="flex min-w-14 flex-col">
                        <span className="tnum text-lg font-semibold leading-tight">
                          {timeFormatter.format(new Date(occ.startAt))}
                        </span>
                        <span className="tnum text-xs text-muted-foreground">
                          {timeFormatter.format(new Date(occ.endAt))}
                        </span>
                      </div>

                      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{occ.serviceName}</span>
                          {isCancelled ? <StatusBadge tone="danger">Cancelado</StatusBadge> : null}
                          {isBlocked ? <StatusBadge tone="warning">Bloqueado</StatusBadge> : null}
                        </div>
                        <span className="text-xs text-muted-foreground">{occ.resourceName}</span>
                        <OccupancyBar confirmed={occ.confirmedCount} capacity={occ.capacity} className="max-w-48" />
                      </div>

                      <div className="flex flex-col items-end gap-0.5">
                        <span className="tnum text-lg font-semibold leading-none">
                          {occ.confirmedCount}
                          <span className="text-sm font-normal text-muted-foreground">/{occ.capacity}</span>
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {isCancelled
                            ? "—"
                            : `${available} ${available === 1 ? "libre" : "libres"}`}
                        </span>
                      </div>
                    </div>

                    <OccurrenceActions
                      organizationSlug={slug}
                      occurrenceId={occ.id}
                      capacity={occ.capacity}
                      attendees={attendees}
                      customers={customers}
                      isCancelled={isCancelled}
                    />
                  </article>
                );
              })}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
