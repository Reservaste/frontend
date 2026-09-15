import Link from "next/link";
import { notFound } from "next/navigation";
import type { PublicAvailabilitySlot } from "@reservaste/domain";
import { getPublicAvailability, getPublicOrganization, listPublicServices } from "@/app/actions/public";
import { availabilityLabel } from "../availability-label";
import { buttonVariants } from "@/components/ui/button";

// Mobile-first: this is the screen someone opens on their phone standing
// in the gym. Everything above the fold is the choice they're making --
// service, day, time -- and nothing else.

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
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 p-4">
        <h1 className="text-xl font-semibold">{organization.name}</h1>
        <p className="text-sm text-muted-foreground">Este negocio todavía no publicó servicios.</p>
      </div>
    );
  }

  const selectedService = services.find((s) => s.id === serviceParam) ?? services[0]!;
  const slots = await getPublicAvailability(organizationSlug, selectedService.id);

  const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: organization.timezone });
  const dayLabelFormatter = new Intl.DateTimeFormat("es-UY", {
    timeZone: organization.timezone,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
  const timeFormatter = new Intl.DateTimeFormat("es-UY", {
    timeZone: organization.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  // Days that actually have slots, in the organization's timezone -- no
  // point offering an empty Tuesday.
  const days: string[] = [];
  for (const slot of slots) {
    const key = dayKeyFormatter.format(new Date(slot.startAt));
    if (!days.includes(key)) days.push(key);
  }

  const selectedDay = dateParam && days.includes(dateParam) ? dateParam : days[0];
  const daySlots: PublicAvailabilitySlot[] = selectedDay
    ? slots.filter((s: PublicAvailabilitySlot) => dayKeyFormatter.format(new Date(s.startAt)) === selectedDay)
    : [];

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-5 p-4">
      <div>
        <Link href={`/${organizationSlug}`} className="text-sm text-muted-foreground hover:text-foreground">
          ← {organization.name}
        </Link>
        <h1 className="mt-1 text-xl font-semibold">Reservar</h1>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Servicio</h2>
        <div className="flex flex-wrap gap-2">
          {services.map((s) => (
            <Link
              key={s.id}
              href={`/${organizationSlug}/reservar?service=${s.id}`}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                s.id === selectedService.id ? "border-foreground bg-foreground text-background" : "hover:bg-muted"
              }`}
            >
              {s.name}
            </Link>
          ))}
        </div>
      </section>

      {days.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No hay horarios publicados para {selectedService.name}.
        </p>
      ) : (
        <>
          <section className="flex flex-col gap-2">
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Día</h2>
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
              {days.map((day) => (
                <Link
                  key={day}
                  href={`/${organizationSlug}/reservar?service=${selectedService.id}&date=${day}`}
                  className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-sm capitalize transition-colors ${
                    day === selectedDay ? "border-foreground bg-foreground text-background" : "hover:bg-muted"
                  }`}
                >
                  {dayLabelFormatter.format(new Date(`${day}T12:00:00Z`))}
                </Link>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Horario</h2>
            <ul className="flex flex-col gap-2">
              {daySlots.map((slot: PublicAvailabilitySlot) => {
                const isFull = slot.status === "FULL" || slot.remaining === 0;
                return (
                  <li
                    key={slot.slotOccurrenceId}
                    className="flex items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <div className="flex flex-col">
                      <span className="text-base font-semibold tabular-nums">
                        {timeFormatter.format(new Date(slot.startAt))}
                      </span>
                      <span className="text-xs text-muted-foreground">{availabilityLabel(slot)}</span>
                    </div>
                    {isFull ? (
                      <span className="text-sm text-muted-foreground">Completo</span>
                    ) : (
                      <Link
                        href={`/${organizationSlug}/reservar/confirmar?slot=${slot.slotOccurrenceId}`}
                        className={buttonVariants({ variant: "default", size: "sm" })}
                      >
                        Reservar
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Horarios en {organization.timezone.replace("_", " ")}
      </p>
    </div>
  );
}
