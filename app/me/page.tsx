import Link from "next/link";
import type { PublicAvailabilitySlot } from "@reservaste/domain";
import {
  getMyBookings,
  getMyCustomerOrganizations,
  getMyMakeupCredits,
} from "@/app/actions/customer";
import { getPublicAvailability, getPublicOrganization } from "@/app/actions/public";
import { availabilityLabel } from "@/app/[organizationSlug]/availability-label";
import { buttonVariants } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/page-header";
import { AlertCircleIcon, CheckIcon, RotateCcwIcon } from "@/components/icons";
import { CustomerCalendar, type CustomerAgendaBooking } from "@/components/calendar/customer-calendar";
import type { PublicSlot } from "@/components/calendar/public-calendar";
import { nowMs } from "@/lib/calendar";
import {
  customerOrganizationOptions,
  pickCustomerOrganization,
  summarizeCredits,
} from "@/lib/my-agenda";

export const metadata = { title: "Mi agenda" };

/**
 * Four weeks of availability, same window as the business's own public
 * page: enough to browse forward without a round trip per arrow, and well
 * inside the 90-day rolling window (ADR-0009).
 */
const AVAILABILITY_DAYS = 28;

function formatDate(value: string) {
  // `expires_on` is a stored `date`, not an instant (ADR-0025) -- read at
  // noon UTC so it never slips a day.
  return new Date(`${value}T12:00:00Z`).toLocaleDateString("es-UY", {
    day: "2-digit",
    month: "2-digit",
  });
}

/**
 * The customer portal's landing screen: an agenda, not a list.
 *
 * It used to be a flat list of upcoming bookings with a "ver pasadas"
 * toggle. For someone who trains three times a week that is a scroll, not
 * a schedule -- "¿qué tengo el jueves?" took reading, and the classes they
 * *could* still take were not on the screen at all, only on the business's
 * public page. The same grid the admin agenda and the public calendar use
 * (ADR-0023) answers both.
 *
 * One organization at a time, chosen by `?org=`: a week grid means one
 * timezone (ADR-0014) and a person can be a Customer of several businesses
 * (ADR-0006). Mixing them would put a 09:00 class in the wrong column.
 */
export default async function MyAgendaPage({
  searchParams,
}: {
  searchParams: Promise<{
    org?: string;
    reservado?: string;
    liberado?: string;
    credito_hasta?: string;
    liberar_error?: string;
  }>;
}) {
  const {
    org: requestedOrg,
    reservado,
    liberado,
    credito_hasta: creditoHasta,
    liberar_error: liberarError,
  } = await searchParams;

  const [bookings, customerOrganizations, credits] = await Promise.all([
    // Past included on purpose: on a calendar, "pasadas" is not a filter,
    // it is the back arrow.
    getMyBookings(true),
    getMyCustomerOrganizations(),
    getMyMakeupCredits(),
  ]);

  const organizations = customerOrganizationOptions(customerOrganizations, bookings);
  const selected = pickCustomerOrganization(organizations, requestedOrg, bookings, nowMs());
  const creditsSummary = summarizeCredits(credits);

  // `my_customer_organizations()` doesn't carry the timezone or the brand,
  // and the public view is the only place a customer-facing screen is
  // allowed to read them from.
  const publicOrganization = selected ? await getPublicOrganization(selected.slug) : null;
  const timeZone = publicOrganization?.timezone ?? selected?.timezone ?? "UTC";

  const now = new Date();
  const rawAvailability = publicOrganization
    ? await getPublicAvailability(
        selected!.slug,
        undefined,
        now,
        new Date(now.getTime() + AVAILABILITY_DAYS * 86_400_000),
      )
    : [];

  const slots: PublicSlot[] = rawAvailability.map((slot: PublicAvailabilitySlot) => ({
    slotOccurrenceId: slot.slotOccurrenceId,
    serviceId: slot.serviceId,
    serviceName: slot.serviceName,
    serviceColor: slot.serviceColor,
    startAt: slot.startAt,
    endAt: slot.endAt,
    // Already respects the disclosure mode of ADR-0008; this page never
    // computes a capacity, it renders the label the database chose.
    availability: availabilityLabel(slot),
    full: slot.status === "FULL" || slot.remaining === 0,
    recentlyReleased: Boolean(slot.recentlyReleased),
  }));

  const myBookings: CustomerAgendaBooking[] = bookings
    .filter((booking) => booking.organizationSlug === selected?.slug)
    .map((booking) => ({
      bookingId: booking.bookingId,
      startAt: booking.startAt,
      endAt: booking.endAt,
      serviceName: booking.serviceName,
      status: booking.status,
      cancellationReason: booking.cancellationReason,
      isRecurring: booking.isRecurring,
      notGeneratedReason: booking.notGeneratedReason,
    }));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-5 py-6">
      <PageHeader
        title="Mi agenda"
        description={selected ? `${selected.name} · horarios en ${timeZone.replace("_", " ")}` : undefined}
      />

      {reservado === "1" ? (
        <Alert tone="success" icon={<CheckIcon />}>
          Listo, tu reserva quedó confirmada.
        </Alert>
      ) : null}

      {liberado === "1" ? (
        <Alert tone="success" icon={<CheckIcon />}>
          {creditoHasta
            ? `Liberaste tu cupo. Te queda un crédito para recuperar la clase, válido hasta el ${formatDate(creditoHasta)}.`
            : "Liberaste tu cupo."}
        </Alert>
      ) : null}

      {/* Fase 25: una liberación que falla no puede verse igual que una que
          salió bien -- la lista volvía a renderizar con la reserva intacta
          y sin una palabra. */}
      {liberarError === "1" ? (
        <Alert tone="danger" icon={<AlertCircleIcon />}>
          No pudimos liberar tu cupo. Volvé a intentar; si sigue igual, avisale al negocio para
          que no te cuenten la falta.
        </Alert>
      ) : null}

      {/* Créditos: el resumen, no la pantalla. Un crédito es una clase que
          ya perdiste y podés recuperar (ADR-0025), así que vencerse sin
          usarlo es el resultado que este bloque existe para evitar -- por
          eso la fecha está acá y el detalle está a un tap. */}
      {creditsSummary.available > 0 ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-success/25 bg-success-subtle px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-card text-success shadow-card">
              <RotateCcwIcon className="size-4" />
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="text-sm font-medium">
                {creditsSummary.available === 1
                  ? "Tenés 1 crédito para recuperar una clase"
                  : `Tenés ${creditsSummary.available} créditos para recuperar clases`}
              </span>
              {creditsSummary.nextExpiry ? (
                <span className="tnum text-xs text-muted-foreground">
                  El primero vence el {formatDate(creditsSummary.nextExpiry)}
                </span>
              ) : null}
            </div>
          </div>
          <Link
            href="/me/creditos"
            className={buttonVariants({ variant: "outline", size: "touch", className: "shrink-0 bg-card" })}
          >
            Ver
          </Link>
        </div>
      ) : null}

      {organizations.length === 0 ? (
        <EmptyState
          title="Todavía no sos cliente de ningún negocio"
          description="Cuando un negocio te habilite, su agenda y tus clases van a aparecer acá."
          action={
            <Link href="/" className={buttonVariants({ variant: "outline", size: "touch" })}>
              Ir al inicio
            </Link>
          }
        />
      ) : (
        <>
          {/* Un cliente puede ser de varios negocios; el calendario muestra
              uno por vez porque una grilla semanal significa una sola zona
              horaria (ADR-0014). Links, no estado de cliente: la elección
              queda en la URL y sobrevive a compartirla o recargar. */}
          {organizations.length > 1 ? (
            <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
              {organizations.map((organization) => {
                const active = organization.slug === selected?.slug;
                return (
                  <Link
                    key={organization.slug}
                    href={`/me?org=${encodeURIComponent(organization.slug)}`}
                    aria-current={active ? "true" : undefined}
                    className={
                      active
                        ? "inline-flex min-h-11 shrink-0 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground shadow-card sm:min-h-9"
                        : "inline-flex min-h-11 shrink-0 items-center rounded-full bg-muted px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground sm:min-h-9"
                    }
                  >
                    {organization.name}
                  </Link>
                );
              })}
            </div>
          ) : null}

          {/* El negocio existe como Customer pero su página pública no
              devuelve nada (suspendido, sin servicio activo): decirlo es
              mejor que una grilla vacía que parece un error de carga. */}
          {!publicOrganization && myBookings.length === 0 ? (
            <EmptyState
              title={`${selected?.name ?? "Este negocio"} no tiene horarios publicados`}
              description="No hay nada para reservar por ahora. Cuando publiquen su agenda vas a verla acá."
            />
          ) : (
            <CustomerCalendar
              organizationSlug={selected!.slug}
              bookings={myBookings}
              slots={slots}
              timeZone={timeZone}
              canBook={Boolean(publicOrganization)}
            />
          )}

          <p className="text-center text-xs text-muted-foreground">
            Tocá una clase tuya para liberar el cupo · tocá un horario libre para reservar
          </p>
        </>
      )}
    </div>
  );
}
