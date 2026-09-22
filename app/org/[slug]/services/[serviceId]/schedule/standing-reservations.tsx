"use client";

import { useActionState, useState } from "react";
import type { OrganizationCustomer } from "@/app/actions/admin";
import {
  cancelStandingReservation,
  createStandingReservation,
  previewStandingReservation,
  type StandingActionState,
  type StandingPreviewState,
  type StandingReservation,
} from "@/app/actions/standing";
import { StatusBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FieldHint, FormError, FormSuccess } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
// One table, shared with the customer-facing flow: the desk wording of the
// same reason codes (ADR-0018 -- the preview and the confirm must never
// disagree, and neither must the two vocabularies).
import { DESK_BOOKING_REASONS } from "@/lib/booking-reasons";

const initialPreview: StandingPreviewState = { error: null, customerId: null, dates: [] };
const initialAction: StandingActionState = { error: null, success: null };

export function StandingReservations({
  organizationSlug,
  serviceId,
  scheduleRuleId,
  ruleLabel,
  customers,
  reservations,
  timezone,
}: {
  organizationSlug: string;
  serviceId: string;
  scheduleRuleId: string;
  ruleLabel: string;
  customers: OrganizationCustomer[];
  reservations: StandingReservation[];
  timezone: string;
}) {
  const [open, setOpen] = useState(false);
  const [preview, previewAction, previewPending] = useActionState(
    previewStandingReservation.bind(null, organizationSlug, scheduleRuleId),
    initialPreview,
  );
  const [created, createAction, createPending] = useActionState(
    createStandingReservation.bind(null, organizationSlug, serviceId, scheduleRuleId),
    initialAction,
  );

  const dateFormatter = new Intl.DateTimeFormat("es-UY", {
    timeZone: timezone,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const active = reservations.filter((r) => r.status === "ACTIVE");
  const alreadyStanding = new Set(active.map((r) => r.customerId));
  const available = customers.filter((c) => c.isActive && !alreadyStanding.has(c.customerId));
  const bookableDates = preview.dates.filter((d) => d.canBook === "OK").length;

  return (
    <div className="flex flex-col gap-3 border-t bg-muted/30 px-4 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="eyebrow text-muted-foreground">Horario fijo ({active.length})</span>
        {!open && available.length > 0 ? (
          <Button variant="outline" size="touch" onClick={() => setOpen(true)}>
            + Asignar cliente
          </Button>
        ) : null}
      </div>

      {active.length > 0 ? (
        <ul className="flex flex-col divide-y overflow-hidden rounded-lg border bg-card">
          {active.map((reservation) => (
            <li
              key={reservation.recurringBookingId}
              className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{reservation.customerName}</span>
                <span className="text-xs text-muted-foreground">
                  <span className="tnum">{reservation.upcomingConfirmed}</span> fechas confirmadas
                  {reservation.upcomingNotGenerated > 0 ? (
                    <>
                      {" · "}
                      <span className="tnum">{reservation.upcomingNotGenerated}</span> sin confirmar
                    </>
                  ) : null}
                </span>
                {reservation.upcomingOverQuota > 0 ? (
                  <span className="text-xs text-warning-foreground">
                    <span className="tnum">{reservation.upcomingOverQuota}</span> de esas fechas
                    exceden la frecuencia que compró. Cobrarle el mes no las destraba: hace falta
                    un plan con más frecuencia, o quitarle otro horario fijo.
                  </span>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {/* A series whose payment lapsed keeps existing but stops
                    confirming dates -- surfaced here so nobody has to
                    notice it from the agenda. */}
                {reservation.upcomingUnpaid > 0 ? (
                  <StatusBadge tone="danger">Falta el pago</StatusBadge>
                ) : null}
                {/* Different problem, different fix (ADR-0024): these
                    dates are not waiting on money. The business sold more
                    fixed slots than the plan covers, and charging the
                    month again would change nothing -- without this the
                    owner never finds out. */}
                {reservation.upcomingOverQuota > 0 ? (
                  <StatusBadge tone="warning">
                    <span className="tnum">{reservation.upcomingOverQuota}</span> fuera del plan
                  </StatusBadge>
                ) : null}
                <form
                  action={cancelStandingReservation.bind(
                    null,
                    organizationSlug,
                    serviceId,
                    reservation.recurringBookingId,
                  )}
                >
                  <Button type="submit" variant="ghost" size="sm">
                    Quitar
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {open ? (
        <div className="flex flex-col gap-3 rounded-lg border bg-card p-3.5">
          {available.length === 0 ? (
            <EmptyState size="sm" title="Todos los clientes activos ya tienen este horario fijo." />
          ) : (
            <>
              {/* Two steps on purpose (ADR-0012): pick the person, see the
                  dates that would actually be reserved, then confirm. */}
              <form action={previewAction} className="flex flex-col gap-1.5">
                <Label htmlFor={`customer-${scheduleRuleId}`}>Cliente</Label>
                <div className="flex flex-wrap gap-2">
                  <Select
                    id={`customer-${scheduleRuleId}`}
                    name="customerId"
                    required
                    touch
                    className="min-w-48 flex-1"
                    defaultValue={preview.customerId ?? ""}
                  >
                    <option value="" disabled>
                      Elegí un cliente
                    </option>
                    {available.map((c) => (
                      <option key={c.customerId} value={c.customerId}>
                        {c.fullName}
                      </option>
                    ))}
                  </Select>
                  <Button type="submit" variant="outline" size="touch" disabled={previewPending}>
                    {previewPending ? "Buscando…" : "Ver fechas"}
                  </Button>
                </div>
              </form>

              <FormError>{preview.error}</FormError>

              {preview.dates.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-muted-foreground">
                    Próximas fechas de {ruleLabel} ·{" "}
                    <span className="tnum font-medium text-foreground">{bookableDates}</span> de{" "}
                    <span className="tnum">{preview.dates.length}</span> se reservarían ahora
                  </p>
                  <ul className="grid gap-1.5 sm:grid-cols-2">
                    {preview.dates.map((date) => (
                      <li
                        key={date.slotOccurrenceId}
                        className="flex items-center justify-between gap-2 rounded-lg border px-3 py-1.5 text-sm"
                      >
                        <span className="tnum">{dateFormatter.format(new Date(date.startAt))}</span>
                        <span
                          className={
                            date.canBook === "OK"
                              ? "text-xs text-muted-foreground"
                              : "text-xs font-medium text-destructive"
                          }
                        >
                          {DESK_BOOKING_REASONS[date.canBook] ?? date.canBook}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <form action={createAction} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="customerId" value={preview.customerId ?? ""} />
                    <Button type="submit" size="touch" disabled={createPending}>
                      {createPending ? "Asignando…" : "Confirmar horario fijo"}
                    </Button>
                    <Button type="button" variant="ghost" size="touch" onClick={() => setOpen(false)}>
                      Cancelar
                    </Button>
                  </form>

                  {/* The series is intentionally created even when some
                      dates can't be reserved yet: those stay pending and
                      confirm on their own once the payment is registered. */}
                  {bookableDates < preview.dates.length ? (
                    <FieldHint>
                      Las fechas que no se reservan quedan pendientes y se confirman solas cuando el pago
                      esté al día.
                    </FieldHint>
                  ) : null}
                </div>
              ) : null}

              <FormError>{created.error}</FormError>
              <FormSuccess>{created.success}</FormSuccess>
            </>
          )}

          {available.length === 0 || preview.dates.length === 0 ? (
            <Button type="button" variant="ghost" size="touch" className="self-start" onClick={() => setOpen(false)}>
              Cerrar
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
