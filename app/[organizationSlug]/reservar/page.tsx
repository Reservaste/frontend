import Link from "next/link";
import { notFound } from "next/navigation";
import type { PublicAvailabilitySlot } from "@reservaste/domain";
import { getPublicAvailability, getPublicOrganization, listPublicServices } from "@/app/actions/public";
import { availabilityLabel } from "../availability-label";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge, availabilityTone } from "@/components/status";

export const metadata = { title: "Reservar" };

// Mobile-first: this is opened on a phone, standing in the gym. The three
// choices stack in the order they're made -- service, day, time -- and
// the time grid is the only thing that scrolls.

export default async function ReservarPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationSlug: string }>;
  searchParams: Promise<{ service?: string; date?: string }>;
}) {
  const { organizationSlug } = await params;
  const { service: serviceParam, date: dateParam } = await searchParams;

  const organization = await getPublicOrganization(organizationSlug);
  if (!organization) {
    notFound();
  }

  const services = await listPublicServices(organization.id);
  if (services.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-5 py-8">
        <EmptyState
          title="Sin servicios publicados"
          description={`${organization.name} todavía no publicó servicios para reservar.`}
        />
      </div>
    );
  }

  const selectedService = services.find((s) => s.id === serviceParam) ?? services[0]!;
  const slots = await getPublicAvailability(organizationSlug, selectedService.id);

  const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: organization.timezone });
  const dayWeekday = new Intl.DateTimeFormat("es-UY", { timeZone: organization.timezone, weekday: "short" });
  const dayNumber = new Intl.DateTimeFormat("es-UY", { timeZone: organization.timezone, day: "2-digit" });
  const dayMonth = new Intl.DateTimeFormat("es-UY", { timeZone: organization.timezone, month: "short" });
  const timeFormatter = new Intl.DateTimeFormat("es-UY", {
    timeZone: organization.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const days: string[] = [];
  for (const slot of slots) {
    const key = dayKey.format(new Date(slot.startAt));
    if (!days.includes(key)) days.push(key);
  }

  const selectedDay = dateParam && days.includes(dateParam) ? dateParam : days[0];
  const daySlots: PublicAvailabilitySlot[] = selectedDay
    ? slots.filter((s: PublicAvailabilitySlot) => dayKey.format(new Date(s.startAt)) === selectedDay)
    : [];

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-lg items-center gap-3 px-5 py-3">
          <Link
            href={`/${organizationSlug}`}
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Volver"
          >
            <svg viewBox="0 0 24 24" fill="none" className="size-4">
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold">{organization.name}</span>
            <span className="text-xs text-muted-foreground">Nueva reserva</span>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-5 py-6">
        <section className="flex flex-col gap-2.5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            1 · Servicio
          </h2>
          <div className="flex flex-wrap gap-2">
            {services.map((s) => {
              const active = s.id === selectedService.id;
              return (
                <Link
                  key={s.id}
                  href={`/${organizationSlug}/reservar?service=${s.id}`}
                  className={`rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-card hover:border-input hover:bg-muted"
                  }`}
                >
                  {s.name}
                </Link>
              );
            })}
          </div>
        </section>

        {days.length === 0 ? (
          <EmptyState
            title="Sin horarios próximos"
            description={`${selectedService.name} no tiene horarios publicados por ahora.`}
          />
        ) : (
          <>
            <section className="flex flex-col gap-2.5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                2 · Día
              </h2>
              <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
                {days.map((day) => {
                  const active = day === selectedDay;
                  const date = new Date(`${day}T12:00:00Z`);
                  return (
                    <Link
                      key={day}
                      href={`/${organizationSlug}/reservar?service=${selectedService.id}&date=${day}`}
                      className={`flex min-w-16 shrink-0 flex-col items-center gap-0.5 rounded-xl border px-3 py-2.5 transition-colors ${
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "bg-card hover:border-input hover:bg-muted"
                      }`}
                    >
                      <span className="text-[11px] font-medium uppercase opacity-80">
                        {dayWeekday.format(date).replace(".", "")}
                      </span>
                      <span className="tnum text-lg font-semibold leading-none">{dayNumber.format(date)}</span>
                      <span className="text-[11px] uppercase opacity-70">
                        {dayMonth.format(date).replace(".", "")}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>

            <section className="flex flex-col gap-2.5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                3 · Horario
              </h2>
              <ul className="grid grid-cols-2 gap-2">
                {daySlots.map((slot) => {
                  const isFull = slot.status === "FULL" || slot.remaining === 0;

                  if (isFull) {
                    return (
                      <li
                        key={slot.slotOccurrenceId}
                        className="flex flex-col items-center gap-1 rounded-xl border border-dashed px-3 py-3 opacity-60"
                      >
                        <span className="tnum text-base font-semibold line-through">
                          {timeFormatter.format(new Date(slot.startAt))}
                        </span>
                        <span className="text-[11px] text-muted-foreground">Completo</span>
                      </li>
                    );
                  }

                  return (
                    <li key={slot.slotOccurrenceId}>
                      <Link
                        href={`/${organizationSlug}/reservar/confirmar?slot=${slot.slotOccurrenceId}`}
                        className="flex flex-col items-center gap-1 rounded-xl border bg-card px-3 py-3 transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-raised"
                      >
                        <span className="tnum text-base font-semibold">
                          {timeFormatter.format(new Date(slot.startAt))}
                        </span>
                        <StatusBadge tone={availabilityTone(slot.status, slot.remaining)}>
                          {availabilityLabel(slot)}
                        </StatusBadge>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          </>
        )}
      </main>

      <footer className="mx-auto w-full max-w-lg px-5 pb-8 text-center">
        <p className="text-xs text-muted-foreground">
          Horarios en {organization.timezone.replace("_", " ")}
        </p>
      </footer>
    </div>
  );
}
