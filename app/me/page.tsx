import Link from "next/link";
import { cancelMyBooking, getMyBookings } from "@/app/actions/customer";
import { Button } from "@/components/ui/button";

export default async function MyBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ pasadas?: string; reservado?: string }>;
}) {
  const { pasadas, reservado } = await searchParams;
  const includePast = pasadas === "1";
  const bookings = await getMyBookings(includePast);

  const visible = includePast ? bookings : bookings.filter((b) => b.status !== "NOT_GENERATED");

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Mis reservas</h1>
        <Link
          href={includePast ? "/me" : "/me?pasadas=1"}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {includePast ? "Solo próximas" : "Ver pasadas"}
        </Link>
      </div>

      {reservado === "1" ? (
        <p className="rounded-md border border-dashed p-3 text-sm">Listo, tu reserva quedó confirmada.</p>
      ) : null}

      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          {includePast ? "No tenés reservas." : "No tenés reservas próximas."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((booking) => {
            const when = new Intl.DateTimeFormat("es-UY", {
              timeZone: booking.organizationTimezone,
              weekday: "short",
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              hourCycle: "h23",
            }).format(new Date(booking.startAt));

            const isUpcoming = new Date(booking.startAt) > new Date();

            return (
              <li
                key={booking.bookingId}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 ${
                  booking.status === "CONFIRMED" ? "" : "opacity-60"
                }`}
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium capitalize tabular-nums">{when}</span>
                  <span className="text-sm">{booking.serviceName}</span>
                  <span className="text-xs text-muted-foreground">
                    {booking.organizationName}
                    {booking.isRecurring ? " · reserva fija" : ""}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {booking.status === "CANCELLED" ? (
                    <span className="text-xs text-muted-foreground">
                      {booking.cancellationReason === "CUSTOMER_REQUEST"
                        ? "Cancelaste"
                        : "Cancelado por el negocio"}
                    </span>
                  ) : booking.status === "NOT_GENERATED" ? (
                    <span className="text-xs text-muted-foreground">Sin lugar esa fecha</span>
                  ) : isUpcoming ? (
                    <form action={cancelMyBooking.bind(null, booking.bookingId)}>
                      <Button type="submit" variant="outline" size="xs">
                        Cancelar
                      </Button>
                    </form>
                  ) : (
                    <span className="text-xs text-muted-foreground">Asististe</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
