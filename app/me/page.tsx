import Link from "next/link";
import { getMyBookings, releaseMyBooking } from "@/app/actions/customer";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status";
import { PageHeader } from "@/components/page-header";
import { DataList, DataListRow } from "@/components/ui/table";
import { CheckIcon } from "@/components/icons";

export const metadata = { title: "Mis reservas" };

export default async function MyBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ pasadas?: string; reservado?: string; liberado?: string; credito_hasta?: string }>;
}) {
  const { pasadas, reservado, liberado, credito_hasta: creditoHasta } = await searchParams;
  const includePast = pasadas === "1";
  const bookings = await getMyBookings(includePast);
  // A date from a standing reservation that didn't confirm stays visible:
  // for someone who pays monthly for a fixed slot, the class quietly
  // disappearing from this list is worse than seeing why it didn't happen.
  const visible = includePast
    ? bookings
    : bookings.filter((b) => b.status !== "NOT_GENERATED" || b.isRecurring);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-5 py-6">
      <PageHeader
        title="Mis reservas"
        actions={
          <Link
            href={includePast ? "/me" : "/me?pasadas=1"}
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {includePast ? "Solo próximas" : "Ver pasadas"}
          </Link>
        }
      />

      {reservado === "1" ? (
        <Alert tone="success" icon={<CheckIcon />}>
          Listo, tu reserva quedó confirmada.
        </Alert>
      ) : null}

      {liberado === "1" ? (
        <Alert tone="success" icon={<CheckIcon />}>
          {creditoHasta
            ? `Liberaste tu cupo. Te queda un crédito para recuperar la clase, válido hasta el ${new Date(
                `${creditoHasta}T00:00:00`,
              ).toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric" })}.`
            : "Liberaste tu cupo."}
        </Alert>
      ) : null}

      {visible.length === 0 ? (
        <EmptyState
          title={includePast ? "No tenés reservas" : "No tenés reservas próximas"}
          description="Cuando reserves un horario va a aparecer acá."
        />
      ) : (
        <DataList>
          {visible.map((booking) => {
            const start = new Date(booking.startAt);
            const dateLabel = new Intl.DateTimeFormat("es-UY", {
              timeZone: booking.organizationTimezone,
              weekday: "short",
              day: "2-digit",
              month: "short",
            }).format(start);
            const timeLabel = new Intl.DateTimeFormat("es-UY", {
              timeZone: booking.organizationTimezone,
              hour: "2-digit",
              minute: "2-digit",
              hourCycle: "h23",
            }).format(start);

            const isUpcoming = start > new Date();
            const cancelled = booking.status === "CANCELLED";

            return (
              <DataListRow
                key={booking.bookingId}
                className={`flex items-center gap-3 px-4 py-3 ${
                  cancelled || booking.status === "NOT_GENERATED" ? "opacity-70" : ""
                }`}
              >
                <div className="flex min-w-14 flex-col items-center rounded-lg bg-muted px-2 py-1.5">
                  <span className="text-[11px] font-medium uppercase text-muted-foreground">
                    {dateLabel.replace(".", "")}
                  </span>
                  <span className="tnum text-sm font-semibold">{timeLabel}</span>
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-sm font-medium">{booking.serviceName}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {/* Booking again at the same place was a dead end: the
                        business name was plain text and its page is only
                        reachable by its link. */}
                    <Link
                      href={`/${booking.organizationSlug}`}
                      className="underline-offset-2 transition-colors hover:text-foreground hover:underline"
                    >
                      {booking.organizationName}
                    </Link>
                    {booking.isRecurring ? " · fija" : ""}
                  </span>
                </div>

                {cancelled ? (
                  <StatusBadge tone="danger">
                    {booking.cancellationReason === "CUSTOMER_REQUEST" ? "Cancelaste" : "Cancelado"}
                  </StatusBadge>
                ) : booking.status === "NOT_GENERATED" ? (
                  <StatusBadge tone={booking.notGeneratedReason === "PAYMENT_REQUIRED" ? "danger" : "warning"}>
                    {booking.notGeneratedReason === "PAYMENT_REQUIRED"
                      ? "Falta el pago"
                      : booking.notGeneratedReason === "DUPLICATE"
                        ? "Ya estás anotado"
                        : // ADR-0024: the month *is* paid and the class is
                          // not full -- saying "sin lugar" here would be
                          // the same lie ADR-0018 removed once already.
                          booking.notGeneratedReason === "OVER_PLAN_QUOTA"
                          ? "Fuera de tu plan"
                          : "Sin lugar"}
                  </StatusBadge>
                ) : isUpcoming ? (
                  <form action={releaseMyBooking.bind(null, booking.bookingId)}>
                    {/* ADR-0025: si el negocio tiene creditos de recupero
                        activados y avisas a tiempo, liberar (en vez de
                        faltar sin avisar) te puede dejar un credito para
                        recuperar la clase dentro del mes -- la RPC decide
                        si corresponde, este boton nunca lo promete. */}
                    <Button
                      type="submit"
                      variant="outline"
                      size="touch"
                      className="shrink-0"
                      title="Si avisás con anticipación, puede quedarte un crédito para recuperar la clase"
                    >
                      Liberar cupo
                    </Button>
                  </form>
                ) : (
                  <StatusBadge tone="success">Asististe</StatusBadge>
                )}
              </DataListRow>
            );
          })}
        </DataList>
      )}
    </div>
  );
}
