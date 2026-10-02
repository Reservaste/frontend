import Link from "next/link";
import { notFound } from "next/navigation";
import { cn } from "cn";
import { getDynamicAvailability } from "@/app/actions/dynamic-booking";
import { getPublicOrganization, getPublicService } from "@/app/actions/public";
import { addDays, parseAnchorKey, todayKey, weekdayOf, WEEKDAY_SHORT } from "@/lib/calendar";
import { BackLink } from "@/components/back-link";
import { BrandTheme } from "@/components/brand-theme";
import { EmptyState } from "@/components/ui/empty-state";

/** Enough to browse forward a couple of weeks without a round trip per day. */
const DAYS_AHEAD = 14;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ organizationSlug: string; serviceId: string }>;
}) {
  const { organizationSlug, serviceId } = await params;
  const organization = await getPublicOrganization(organizationSlug);
  if (!organization) return { title: "Horarios" };
  const service = await getPublicService(organization.id, serviceId);
  return { title: service ? `Horarios de ${service.name}` : "Horarios" };
}

/**
 * ADR-0051: elegir día y horario para un servicio cuyo recurso calcula su
 * disponibilidad al momento de reservar, en vez de depender de la grilla
 * pre-generada (`get_dynamic_availability()`). No reusa `PublicCalendar`
 * -- no hay una grilla de `SlotOccurrence` que mostrar como calendario,
 * sólo una lista de horarios posibles para el día elegido.
 */
export default async function ReservarDinamicoPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationSlug: string; serviceId: string }>;
  searchParams: Promise<{ fecha?: string }>;
}) {
  const { organizationSlug, serviceId } = await params;
  const { fecha } = await searchParams;

  const organization = await getPublicOrganization(organizationSlug);
  if (!organization) {
    notFound();
  }

  const service = await getPublicService(organization.id, serviceId);
  // Esta pantalla sólo existe para servicios con recurso dinámico -- uno
  // sin ese flag no tiene `get_dynamic_availability()` que mostrarle, usa
  // el calendario de grilla de siempre.
  if (!service || !service.hasDynamicResource) {
    notFound();
  }

  const today = todayKey(organization.timezone);
  const activeDate = parseAnchorKey(fecha) ?? today;
  const days = Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(today, i));

  const slots = await getDynamicAvailability(organizationSlug, serviceId, activeDate);

  const timeFormatter = new Intl.DateTimeFormat("es-UY", {
    timeZone: organization.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  return (
    <BrandTheme
      color={organization.brandColor}
      className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-5 py-5"
    >
      <BackLink href={`/${organizationSlug}`}>{organization.name}</BackLink>

      <div className="flex flex-col gap-1">
        <h1 className="text-xl">{service.name}</h1>
        <p className="text-sm text-muted-foreground">Elegí el día y el horario</p>
      </div>

      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
        {days.map((day) => {
          const active = day === activeDate;
          const label = `${WEEKDAY_SHORT[weekdayOf(day)]} ${new Date(`${day}T12:00:00Z`).getUTCDate()}`;
          return (
            <Link
              key={day}
              href={`/${organizationSlug}/reservar-dinamico/${serviceId}?fecha=${day}`}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-2 text-sm font-medium transition-all",
                active
                  ? "bg-primary text-primary-foreground shadow-card"
                  : "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground",
              )}
            >
              {label}
            </Link>
          );
        })}
      </div>

      {slots.length === 0 ? (
        <EmptyState
          size="sm"
          title="No hay horarios disponibles este día"
          description="Probá otro día."
        />
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {slots.map((slot) => (
            <Link
              key={`${slot.resourceId}:${slot.startAt}`}
              href={`/${organizationSlug}/reservar-dinamico/${serviceId}/confirmar?resource=${encodeURIComponent(
                slot.resourceId,
              )}&start=${encodeURIComponent(slot.startAt)}`}
              className="flex flex-col items-center gap-0.5 rounded-xl border bg-card px-3 py-3 text-center shadow-card transition-all hover:shadow-raised"
            >
              <span className="tnum text-base font-semibold">
                {timeFormatter.format(new Date(slot.startAt))}
              </span>
              {/* ADR-0048: sólo si la organización optó por mostrar "con
                  quién" -- null se trata como "no reveles nada", nunca se
                  inventa un nombre. */}
              {slot.resourceName ? (
                <span className="text-xs text-muted-foreground">{slot.resourceName}</span>
              ) : null}
            </Link>
          ))}
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Horarios en {organization.timezone.replace("_", " ")}
      </p>
    </BrandTheme>
  );
}
