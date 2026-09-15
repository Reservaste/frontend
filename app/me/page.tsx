import Link from "next/link";
import { cancelMyBooking, getMyBookings } from "@/app/actions/customer";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status";

export const metadata = { title: "Mis reservas" };

export default async function MyBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ pasadas?: string; reservado?: string }>;
}) {
  const { pasadas, reservado } = await searchParams;
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
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl">Mis reservas</h1>
        <Link
          href={includePast ? "/me" : "/me?pasadas=1"}
          className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {includePast ? "Solo próximas" : "Ver pasadas"}
        </Link>
      </div>

      {reservado === "1" ? (
        <p className="flex items-center gap-2 rounded-xl bg-success-subtle px-4 py-3 text-sm text-success">
          <svg viewBox="0 0 24 24" fill="none" className="size-4 shrink-0">
            <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Listo, tu reserva quedó confirmada.
        </p>
      ) : null}

      {visible.length === 0 ? (
        <EmptyState
          title={includePast ? "No tenés reservas" : "No tenés reservas próximas"}
          description="Cuando reserves un horario va a aparecer acá."
        />
      ) : (
        <ul className="flex flex-col gap-2">
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
              <li
                key={booking.bookingId}
                className={`flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-card ${
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
                  <StatusBadge tone={booking.notGeneratedReason === "NO_ENTITLEMENT" ? "danger" : "warning"}>
                    {booking.notGeneratedReason === "NO_ENTITLEMENT"
                      ? "Falta el pago"
                      : booking.notGeneratedReason === "DUPLICATE"
                        ? "Ya estás anotado"
                        : "Sin lugar"}
                  </StatusBadge>
                ) : isUpcoming ? (
                  <form action={cancelMyBooking.bind(null, booking.bookingId)}>
                    <Button type="submit" variant="outline" size="xs">
                      Cancelar
                    </Button>
                  </form>
                ) : (
                  <StatusBadge tone="success">Asististe</StatusBadge>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
