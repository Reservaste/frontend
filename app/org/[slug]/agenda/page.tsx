import Link from "next/link";
import { requireOrganizationMembership } from "@/app/actions/organizations";
import { getAgenda, getCustomers, getOccurrenceAttendees } from "@/app/actions/admin";
import { OccurrenceActions } from "./occurrence-actions";

type View = "day" | "week";

/**
 * Start of the given local day *in the organization's timezone*, returned
 * as a real instant. Everything the agenda queries is timestamptz, so the
 * range has to be built from the org's wall clock, not the server's --
 * otherwise a Montevideo gym running on a US-hosted server would see the
 * wrong day's classes around midnight (ADR-0014).
 */
function startOfLocalDay(date: Date, timeZone: string): Date {
  const localDate = new Intl.DateTimeFormat("en-CA", { timeZone }).format(date); // YYYY-MM-DD
  // Probe the zone's offset at that date, then subtract it from midnight.
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
    day: "2-digit",
    month: "2-digit",
  });
  const timeFormatter = new Intl.DateTimeFormat("es-UY", {
    timeZone: organization.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const anchorIso = new Intl.DateTimeFormat("en-CA", { timeZone: organization.timezone }).format(anchor);
  const prevIso = new Intl.DateTimeFormat("en-CA", { timeZone: organization.timezone }).format(
    addDays(anchor, view === "week" ? -7 : -1),
  );
  const nextIso = new Intl.DateTimeFormat("en-CA", { timeZone: organization.timezone }).format(
    addDays(anchor, view === "week" ? 7 : 1),
  );

  // Group by local day so the week view reads as days, not one long list.
  const groups = new Map<string, typeof occurrences>();
  for (const occ of occurrences) {
    const key = dayFormatter.format(new Date(occ.startAt));
    const list = groups.get(key) ?? [];
    list.push(occ);
    groups.set(key, list);
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Agenda</h1>
        <div className="flex items-center gap-1 text-sm">
          <Link
            href={`/org/${slug}/agenda?view=day&date=${anchorIso}`}
            className={`rounded-md px-2 py-1 ${view === "day" ? "bg-muted font-medium" : "text-muted-foreground"}`}
          >
            Día
          </Link>
          <Link
            href={`/org/${slug}/agenda?view=week&date=${anchorIso}`}
            className={`rounded-md px-2 py-1 ${view === "week" ? "bg-muted font-medium" : "text-muted-foreground"}`}
          >
            Semana
          </Link>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm">
        <Link href={`/org/${slug}/agenda?view=${view}&date=${prevIso}`} className="text-muted-foreground hover:text-foreground">
          ← Anterior
        </Link>
        <span className="text-muted-foreground">{organization.timezone}</span>
        <Link href={`/org/${slug}/agenda?view=${view}&date=${nextIso}`} className="text-muted-foreground hover:text-foreground">
          Siguiente →
        </Link>
      </div>

      {occurrences.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No hay horarios en este período.
          </p>
          <Link href={`/org/${slug}/services`} className="mt-2 inline-block text-sm underline underline-offset-4">
            Configurar horarios
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {[...groups.entries()].map(([day, dayOccurrences]) => (
            <section key={day} className="flex flex-col gap-2">
              <h2 className="text-sm font-medium capitalize text-muted-foreground">{day}</h2>
              {dayOccurrences.map((occ) => {
                const index = occurrences.indexOf(occ);
                const attendees = attendeesByOccurrence[index] ?? [];
                const available = occ.capacity - occ.confirmedCount;
                const isCancelled = occ.status === "CANCELLED";

                return (
                  <article
                    key={occ.id}
                    className={`flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3 ${
                      isCancelled ? "opacity-60" : ""
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="text-base font-semibold tabular-nums">
                        {timeFormatter.format(new Date(occ.startAt))}
                      </span>
                      <span className="text-sm">{occ.serviceName}</span>
                      <span className="text-xs text-muted-foreground">{occ.resourceName}</span>
                    </div>

                    <div className="flex flex-col items-end">
                      <span className="text-base font-semibold tabular-nums">
                        {occ.confirmedCount} / {occ.capacity}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {isCancelled
                          ? "Cancelado"
                          : occ.status === "BLOCKED"
                            ? "Bloqueado"
                            : `${available} ${available === 1 ? "disponible" : "disponibles"}`}
                      </span>
                    </div>

                    <div className="w-full">
                      <OccurrenceActions
                        organizationSlug={slug}
                        occurrenceId={occ.id}
                        capacity={occ.capacity}
                        attendees={attendees}
                        customers={customers}
                        isCancelled={isCancelled}
                      />
                    </div>
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
