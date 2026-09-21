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

const selectClass =
  "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const initialPreview: StandingPreviewState = { error: null, customerId: null, dates: [] };
const initialAction: StandingActionState = { error: null, success: null };

// The same reason codes the customer-facing flow uses, worded for whoever
// is standing at the desk rather than for the customer.
const DESK_REASONS: Record<string, string> = {
  OK: "Se reserva",
  PAYMENT_REQUIRED: "El pago no cubre esa fecha",
  SLOT_FULL: "Completo",
  ALREADY_BOOKED: "Ya está anotado",
  NOT_A_CUSTOMER: "No es cliente",
  OCCURRENCE_NOT_AVAILABLE: "Turno no disponible",
  SERVICE_INACTIVE: "Servicio inactivo",
  ORGANIZATION_INACTIVE: "Organización inactiva",
};

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
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Horario fijo ({active.length})
        </span>
        {!open && available.length > 0 ? (
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
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
              </div>
              <div className="flex items-center gap-2">
                {/* A series whose payment lapsed keeps existing but stops
                    confirming dates -- surfaced here so nobody has to
                    notice it from the agenda. */}
                {reservation.upcomingUnpaid > 0 ? (
                  <StatusBadge tone="danger">Falta el pago</StatusBadge>
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
            <p className="text-sm text-muted-foreground">
              Todos los clientes activos ya tienen este horario fijo.
            </p>
          ) : (
            <>
              {/* Two steps on purpose (ADR-0012): pick the person, see the
                  dates that would actually be reserved, then confirm. */}
              <form action={previewAction} className="flex flex-col gap-1.5">
                <Label htmlFor={`customer-${scheduleRuleId}`}>Cliente</Label>
                <div className="flex flex-wrap gap-2">
                  <select
                    id={`customer-${scheduleRuleId}`}
                    name="customerId"
                    required
                    className={`${selectClass} flex-1 min-w-48`}
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
                  </select>
                  <Button type="submit" variant="outline" size="sm" disabled={previewPending}>
                    {previewPending ? "Buscando…" : "Ver fechas"}
                  </Button>
                </div>
              </form>

              {preview.error ? <p className="text-sm text-destructive">{preview.error}</p> : null}

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
                          {DESK_REASONS[date.canBook] ?? date.canBook}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <form action={createAction} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="customerId" value={preview.customerId ?? ""} />
                    <Button type="submit" size="sm" disabled={createPending}>
                      {createPending ? "Asignando…" : "Confirmar horario fijo"}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                      Cancelar
                    </Button>
                  </form>

                  {/* The series is intentionally created even when some
                      dates can't be reserved yet: those stay pending and
                      confirm on their own once the payment is registered. */}
                  {bookableDates < preview.dates.length ? (
                    <p className="text-xs text-muted-foreground">
                      Las fechas que no se reservan quedan pendientes y se confirman solas cuando el pago
                      esté al día.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {created.error ? <p className="text-sm text-destructive">{created.error}</p> : null}
              {created.success ? <p className="text-sm text-success">{created.success}</p> : null}
            </>
          )}

          {available.length === 0 || preview.dates.length === 0 ? (
            <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => setOpen(false)}>
              Cerrar
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
