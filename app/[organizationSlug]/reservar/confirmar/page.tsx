import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { checkCanBook, getSlotDetail } from "@/app/actions/customer";
import { BOOKING_REASONS } from "@/lib/booking-reasons";
import { availabilityLabel } from "../../availability-label";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge, availabilityTone } from "@/components/status";
import { ConfirmForm } from "./confirm-form";

export const metadata = { title: "Confirmar reserva" };

/**
 * ADR-0015, the post-login step. Three things happen here and the order
 * matters:
 *
 *  1. If nobody is signed in, bounce to login carrying this exact URL as
 *     returnTo -- the booking intent lives in the URL, unsigned, because
 *     it is public data and gets re-validated below regardless.
 *  2. Re-render *what is about to be booked* and re-run the eligibility
 *     check, so a slot that filled up during login says so here rather
 *     than failing after a click.
 *  3. Never book automatically. The person confirms explicitly -- that's
 *     what stops a link someone was sent from silently consuming their
 *     credit.
 */
export default async function ConfirmarPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationSlug: string }>;
  searchParams: Promise<{ slot?: string }>;
}) {
  const { organizationSlug } = await params;
  const { slot } = await searchParams;

  if (!slot) {
    redirect(`/${organizationSlug}/reservar`);
  }

  const detail = await getSlotDetail(slot);
  if (!detail || detail.organizationSlug !== organizationSlug) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const returnTo = `/${organizationSlug}/reservar/confirmar?slot=${slot}`;
    redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  }

  const canBook = await checkCanBook(slot);

  const dateFormatter = new Intl.DateTimeFormat("es-UY", {
    timeZone: detail.organizationTimezone,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const timeFormatter = new Intl.DateTimeFormat("es-UY", {
    timeZone: detail.organizationTimezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const start = new Date(detail.startAt);
  const end = new Date(detail.endAt);

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-5 py-8">
      <Link
        href={`/${organizationSlug}/reservar?service=${detail.serviceId}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <svg viewBox="0 0 24 24" fill="none" className="size-4">
          <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Cambiar horario
      </Link>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-raised">
        <div className="flex flex-col items-center gap-1 border-b bg-primary-subtle px-6 py-6 text-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">
            {detail.organizationName}
          </span>
          <h1 className="text-xl">{detail.serviceName}</h1>
        </div>

        <div className="flex flex-col gap-5 px-6 py-6">
          <div className="flex flex-col items-center gap-1 text-center">
            <p className="text-sm capitalize text-muted-foreground">{dateFormatter.format(start)}</p>
            <p className="tnum text-3xl font-semibold">
              {timeFormatter.format(start)}
              <span className="text-lg font-normal text-muted-foreground"> – {timeFormatter.format(end)}</span>
            </p>
            <StatusBadge tone={availabilityTone(detail.status, detail.remaining)} className="mt-1">
              {availabilityLabel(detail)}
            </StatusBadge>
          </div>

          {canBook === "OK" ? (
            <ConfirmForm slotOccurrenceId={slot} />
          ) : (
            <div className="flex flex-col gap-3">
              <p className="rounded-xl bg-warning-subtle px-4 py-3 text-sm text-warning-foreground">
                {BOOKING_REASONS[canBook] ?? "No podés reservar este horario"}
              </p>
              <Link
                href={`/${organizationSlug}/reservar?service=${detail.serviceId}`}
                className="text-center text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Ver otros horarios
              </Link>
            </div>
          )}
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Horario en {detail.organizationTimezone.replace("_", " ")}
      </p>
    </div>
  );
}
