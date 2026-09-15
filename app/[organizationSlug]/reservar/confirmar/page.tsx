import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { checkCanBook, getSlotDetail } from "@/app/actions/customer";
import { BOOKING_REASONS } from "@/lib/booking-reasons";
import { availabilityLabel } from "../../availability-label";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmForm } from "./confirm-form";

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

  const whenFormatter = new Intl.DateTimeFormat("es-UY", {
    timeZone: detail.organizationTimezone,
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 p-4">
      <Link
        href={`/${organizationSlug}/reservar?service=${detail.serviceId}`}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Cambiar horario
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Confirmá tu reserva</CardTitle>
          <CardDescription>{detail.organizationName}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Servicio</dt>
              <dd className="text-right font-medium">{detail.serviceName}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Cuándo</dt>
              <dd className="text-right font-medium capitalize">
                {whenFormatter.format(new Date(detail.startAt))}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Disponibilidad</dt>
              <dd className="text-right">{availabilityLabel(detail)}</dd>
            </div>
          </dl>

          {canBook === "OK" ? (
            <ConfirmForm slotOccurrenceId={slot} />
          ) : (
            <div className="flex flex-col gap-3">
              <p className="rounded-md bg-muted p-3 text-sm">{BOOKING_REASONS[canBook] ?? "No podés reservar este horario"}</p>
              <Link
                href={`/${organizationSlug}/reservar?service=${detail.serviceId}`}
                className="text-center text-sm underline underline-offset-4"
              >
                Ver otros horarios
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Horario en {detail.organizationTimezone.replace("_", " ")}
      </p>
    </div>
  );
}
