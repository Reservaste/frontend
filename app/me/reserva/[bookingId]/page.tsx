import Link from "next/link";
import { notFound } from "next/navigation";
import { getMyBookings, releaseMyBooking } from "@/app/actions/customer";
import { BOOKING_REASONS } from "@/lib/booking-reasons";
import { nowMs } from "@/lib/calendar";
import { BackLink } from "@/components/back-link";
import { StatusBadge } from "@/components/status";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { AlertCircleIcon, AlertTriangleIcon, InfoIcon } from "@/components/icons";

export const metadata = { title: "Mi reserva" };

/**
 * One booking, and whatever can still be done about it.
 *
 * The agenda at /me replaced a list whose rows carried a "Liberar cupo"
 * button; a calendar block is 64px tall and cannot. So the action moved
 * here, where there is room to say what liberar actually does (ADR-0025:
 * on time, it may leave a credit -- the RPC decides, this screen never
 * promises it) and to spell out *why* a standing-reservation date did not
 * confirm, which was a three-word badge before.
 *
 * Reads through `my_bookings()` and filters here rather than through a new
 * single-booking query: the RPC already scopes to the caller's own
 * bookings (ADR-0006), so a bookingId belonging to someone else simply
 * isn't in the result and lands on notFound() -- no ownership check
 * invented in the UI.
 */
export default async function MyBookingPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  const bookings = await getMyBookings(true);
  const booking = bookings.find((candidate) => candidate.bookingId === bookingId);

  if (!booking) {
    notFound();
  }

  const start = new Date(booking.startAt);
  const end = new Date(booking.endAt);
  const dateLabel = new Intl.DateTimeFormat("es-UY", {
    timeZone: booking.organizationTimezone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(start);
  const timeFormatter = new Intl.DateTimeFormat("es-UY", {
    timeZone: booking.organizationTimezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const isUpcoming = start.getTime() > nowMs();
  const cancelled = booking.status === "CANCELLED";
  const pending = booking.status === "NOT_GENERATED";

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-5 py-6">
      <BackLink href={`/me?org=${encodeURIComponent(booking.organizationSlug)}`}>Mi agenda</BackLink>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-raised">
        <div className="flex flex-col items-center gap-1 border-b bg-primary-subtle px-6 py-6 text-center">
          <span className="eyebrow text-primary">{booking.organizationName}</span>
          <h1 className="text-xl">{booking.serviceName}</h1>
        </div>

        <div className="flex flex-col gap-5 px-6 py-6">
          <div className="flex flex-col items-center gap-1 text-center">
            <p className="text-sm capitalize text-muted-foreground">{dateLabel}</p>
            <p className="tnum text-3xl font-semibold">
              {timeFormatter.format(start)}
              <span className="text-lg font-normal text-muted-foreground">
                {" "}
                – {timeFormatter.format(end)}
              </span>
            </p>
            {booking.isRecurring ? (
              <StatusBadge tone="neutral" className="mt-1">
                Reserva fija
              </StatusBadge>
            ) : null}
          </div>

          {cancelled ? (
            <Alert tone="info" icon={<InfoIcon />}>
              {booking.cancellationReason === "CUSTOMER_REQUEST"
                ? "Liberaste este cupo. Ya no estás anotado."
                : "El negocio canceló esta clase."}
            </Alert>
          ) : pending ? (
            // ADR-0018/ADR-0024: cada motivo tiene un remedio distinto y
            // ninguno es "sin lugar" genérico. El texto largo es el mismo
            // que usa la pantalla de confirmación, no una segunda versión.
            <Alert
              tone={booking.notGeneratedReason === "SLOT_FULL" ? "info" : "warning"}
              icon={
                booking.notGeneratedReason === "SLOT_FULL" ? (
                  <InfoIcon />
                ) : (
                  <AlertTriangleIcon />
                )
              }
            >
              {BOOKING_REASONS[booking.notGeneratedReason ?? ""] ??
                "Esta fecha de tu reserva fija no se confirmó."}
            </Alert>
          ) : isUpcoming ? (
            <div className="flex flex-col gap-3">
              <Alert tone="success" icon={<InfoIcon />} size="sm">
                Tenés tu lugar reservado. Si no vas a poder ir, liberá el cupo: avisando con
                anticipación puede quedarte un crédito para recuperar la clase.
              </Alert>
              {/* ADR-0025: la RPC decide si corresponde el crédito. Este
                  botón no lo promete, sólo libera. */}
              <form action={releaseMyBooking.bind(null, booking.bookingId)}>
                <Button type="submit" variant="outline" size="touch" className="w-full">
                  Liberar cupo
                </Button>
              </form>
            </div>
          ) : (
            <Alert tone="success" icon={<InfoIcon />}>
              Esta clase ya pasó.
            </Alert>
          )}

          {booking.occurrenceStatus === "CANCELLED" && !cancelled ? (
            <Alert tone="danger" icon={<AlertCircleIcon />} size="sm">
              El negocio canceló este horario.
            </Alert>
          ) : null}

          <Link
            href={`/${booking.organizationSlug}`}
            className={buttonVariants({ variant: "ghost", size: "touch", className: "w-full" })}
          >
            Ver la agenda de {booking.organizationName}
          </Link>
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Horario en {booking.organizationTimezone.replace("_", " ")}
      </p>
    </div>
  );
}
