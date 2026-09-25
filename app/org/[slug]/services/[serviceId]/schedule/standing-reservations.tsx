"use client";

import { useActionState, useState } from "react";
import type { OrganizationCustomer } from "@/app/actions/admin";
import {
  cancelStandingReservation,
  createStandingReservation,
  listStandingReservationOccurrences,
  previewStandingReservation,
  type StandingActionState,
  type StandingOccurrence,
  type StandingOccurrenceStatus,
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

type OccurrenceDetailState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "loaded"; dates: StandingOccurrence[] };

// Mismos tres tonos que ya usan los badges de la fila (danger/warning/
// neutral) -- un cuarto color para "confirmada" sería el raro, así que
// comparte el tono neutral con las otras dos categorías que no son un
// problema.
function occurrenceStatusClassName(status: StandingOccurrenceStatus): string {
  if (status === "UNPAID") return "text-xs font-medium text-destructive";
  if (status === "OVER_QUOTA") return "text-xs font-medium text-warning-foreground";
  return "text-xs text-muted-foreground";
}

export function StandingReservations({
  organizationSlug,
  serviceId,
  scheduleRuleId,
  ruleLabel,
  customers,
  reservations,
  timezone,
  canManage,
}: {
  organizationSlug: string;
  serviceId: string;
  scheduleRuleId: string;
  ruleLabel: string;
  customers: OrganizationCustomer[];
  reservations: StandingReservation[];
  timezone: string;
  /**
   * ADR-0033 `MANAGE_BOOKINGS`: assigning or removing a standing
   * reservation. Without it the list is read-only (the payment/quota
   * signals stay visible on purpose -- ADR-0033 resolución 2).
   */
  canManage: boolean;
}) {
  const [open, setOpen] = useState(false);
  // Fecha por fecha de una serie ya activa (lo que pidió el dueño): a
  // demanda, por fila, no precargado para toda la lista -- una organización
  // puede tener varias decenas de horarios fijos activos y la ventana
  // rodante son 90 días de ocurrencias cada uno.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [occurrenceDetails, setOccurrenceDetails] = useState<Record<string, OccurrenceDetailState>>({});
  // Controlled on purpose: the select lives in the *create* form now, and
  // both the quick path and the optional preview submit from there. An
  // uncontrolled value would be wiped by React's post-action form reset
  // between "ver detalle" and "confirmar".
  const [customerId, setCustomerId] = useState("");
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

  // Derived, not stored: once the series exists the customer drops out of
  // `available`, so the selection clears itself without an effect.
  const selected = available.some((c) => c.customerId === customerId) ? customerId : "";
  // The detail belongs to whoever was asked about. Showing A's dates under
  // B's name is the exact discrepancy the preview exists to avoid.
  const previewMatches = selected !== "" && preview.customerId === selected;

  async function loadOccurrenceDetail(recurringBookingId: string) {
    setOccurrenceDetails((prev) => ({ ...prev, [recurringBookingId]: { status: "loading" } }));
    try {
      const dates = await listStandingReservationOccurrences(organizationSlug, recurringBookingId);
      setOccurrenceDetails((prev) => ({ ...prev, [recurringBookingId]: { status: "loaded", dates } }));
    } catch {
      setOccurrenceDetails((prev) => ({ ...prev, [recurringBookingId]: { status: "error" } }));
    }
  }

  function toggleOccurrenceDetail(recurringBookingId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(recurringBookingId)) {
        next.delete(recurringBookingId);
      } else {
        next.add(recurringBookingId);
        const current = occurrenceDetails[recurringBookingId];
        // No relee si ya la trajo: colapsar y volver a abrir no dispara un
        // segundo pedido. Un error sí reintenta.
        if (!current || current.status === "error") {
          void loadOccurrenceDetail(recurringBookingId);
        }
      }
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-3 border-t bg-muted/30 px-4 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* ruleLabel already carries day + time ("Mar 14:00"); without it
            here, N identical "Horario fijo" blocks stack for a group that
            spans N weekdays and nothing tells them apart until you open
            one (it was only reaching the preview text further down). */}
        <span className="eyebrow text-muted-foreground">
          {ruleLabel} · fijo ({active.length})
        </span>
        {canManage && !open && available.length > 0 ? (
          <Button variant="outline" size="touch" onClick={() => setOpen(true)}>
            + Asignar cliente
          </Button>
        ) : null}
      </div>

      {active.length > 0 ? (
        <ul className="flex flex-col divide-y overflow-hidden rounded-lg border bg-card">
          {active.map((reservation) => {
            const isExpanded = expandedIds.has(reservation.recurringBookingId);
            const detail = occurrenceDetails[reservation.recurringBookingId];
            return (
              <li
                key={reservation.recurringBookingId}
                className="flex flex-col gap-2 px-3.5 py-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
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
                    {/* Fase 38: el badge rojo "Falta el pago" de abajo no
                        tenía ninguna oración propia acá -- el ojo caía en la
                        de `upcomingBeyondPeriod` (la única que había) y la
                        leía como si contradijera al badge, cuando hablan de
                        fechas distintas. Mismo orden que el bloque de badges:
                        lo accionable primero. */}
                    {reservation.upcomingUnpaid > 0 ? (
                      <span className="text-xs text-destructive">
                        <span className="tnum">{reservation.upcomingUnpaid}</span>{" "}
                        {reservation.upcomingUnpaid === 1
                          ? "fecha está esperando"
                          : "fechas están esperando"}{" "}
                        que se ponga al día el pago del período actual para confirmarse.
                      </span>
                    ) : null}
                    {reservation.upcomingOverQuota > 0 ? (
                      <span className="text-xs text-warning-foreground">
                        <span className="tnum">{reservation.upcomingOverQuota}</span> de esas fechas
                        exceden la frecuencia que compró. Cobrarle el mes no las destraba: hace falta
                        un plan con más frecuencia, o quitarle otro horario fijo.
                      </span>
                    ) : null}
                    {/* Fase 25: la agenda mira 90 días y ningún pago mensual
                        cubre 90 días, así que estas fechas existen siempre y
                        hasta ahora quedaban contadas como "sin confirmar", sin
                        explicación -- que es como se leía el "Falta el pago"
                        que no se apagaba nunca. No son deuda: todavía no se
                        facturan. */}
                    {reservation.upcomingBeyondPeriod > 0 ? (
                      <span className="text-xs text-muted-foreground">
                        <span className="tnum">{reservation.upcomingBeyondPeriod}</span> caen más
                        adelante que el período que ya pagó. No hay nada para cobrar todavía: se
                        confirman solas cuando pague ese período.
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
                    {/* Neutral a propósito: no es un problema de nadie ni algo
                        que haya que resolver hoy, es el horizonte de cobro. Un
                        tono de alerta acá es exactamente el bug que se
                        corrigió. */}
                    {reservation.upcomingBeyondPeriod > 0 ? (
                      <StatusBadge tone="neutral">
                        <span className="tnum">{reservation.upcomingBeyondPeriod}</span> fuera del
                        período
                      </StatusBadge>
                    ) : null}
                    {/* Fecha por fecha, a pedido explícito del dueño: qué
                        está agendado y qué no, no sólo el conteo. Visible
                        con o sin `canManage` -- es lectura, igual que los
                        badges. */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleOccurrenceDetail(reservation.recurringBookingId)}
                      aria-expanded={isExpanded}
                    >
                      {isExpanded ? "Ocultar fechas" : "Ver fechas"}
                    </Button>
                    {canManage ? (
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
                    ) : null}
                  </div>
                </div>

                {isExpanded ? (
                  <div className="rounded-lg border bg-muted/30 p-3">
                    {!detail || detail.status === "loading" ? (
                      <p className="text-xs text-muted-foreground">Buscando fechas…</p>
                    ) : detail.status === "error" ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs text-destructive">No se pudieron cargar las fechas.</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void loadOccurrenceDetail(reservation.recurringBookingId)}
                        >
                          Reintentar
                        </Button>
                      </div>
                    ) : detail.dates.length === 0 ? (
                      <EmptyState
                        size="sm"
                        title="No hay próximas fechas publicadas para este horario."
                      />
                    ) : (
                      <ul className="grid gap-1.5 sm:grid-cols-2">
                        {detail.dates.map((occurrence) => (
                          <li
                            key={occurrence.slotOccurrenceId}
                            className="flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-1.5 text-sm"
                          >
                            <span className="tnum">
                              {dateFormatter.format(new Date(occurrence.startAt))}
                            </span>
                            <span className={occurrenceStatusClassName(occurrence.status)}>
                              {DESK_BOOKING_REASONS[occurrence.status] ?? occurrence.status}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {canManage && open ? (
        <div className="flex flex-col gap-3 rounded-lg border bg-card p-3.5">
          {available.length === 0 ? (
            <EmptyState size="sm" title="Todos los clientes activos ya tienen este horario fijo." />
          ) : (
            <>
              {/* Un solo form, dos submits. Asignar un cupo fijo es una
                  decisión ya tomada en el mostrador ("este cliente tiene los
                  lunes a las 9"), así que el camino corto es el botón
                  primario y el detalle fecha por fecha de ADR-0012 quedó como
                  segundo submit del mismo form. Saltearlo no relaja nada: el
                  preview nunca validó (membresía, pertenencia, serie
                  duplicada y cupo del plan se verifican dentro de
                  `admin_create_recurring_booking`), sólo informaba — y esa
                  información ahora vuelve en `created.success`. */}
              <form action={createAction} className="flex flex-col gap-2.5">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`customer-${scheduleRuleId}`}>Cliente</Label>
                  <Select
                    id={`customer-${scheduleRuleId}`}
                    name="customerId"
                    required
                    touch
                    className="min-w-48"
                    value={selected}
                    onChange={(event) => setCustomerId(event.target.value)}
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
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button type="submit" size="touch" disabled={createPending || previewPending}>
                    {createPending ? "Asignando…" : "Asignar horario fijo"}
                  </Button>
                  {/* Secundario y opcional: mismo form, otra acción. */}
                  <Button
                    type="submit"
                    formAction={previewAction}
                    variant="outline"
                    size="touch"
                    disabled={createPending || previewPending}
                  >
                    {previewPending ? "Buscando…" : "Ver detalle antes de confirmar"}
                  </Button>
                  <Button type="button" variant="ghost" size="touch" onClick={() => setOpen(false)}>
                    Cancelar
                  </Button>
                </div>

                {/* `recurring_bookings.end_date` nace null y la ventana
                    rodante de ADR-0009 le sigue agregando fechas mientras la
                    serie esté ACTIVE. La pantalla nunca lo dijo, y es lo
                    primero que el mostrador necesita saber antes de apretar. */}
                <FieldHint>
                  Se repite todas las semanas, sin fecha de fin, hasta que lo quites. Las fechas que
                  hoy no se puedan reservar quedan pendientes y se confirman solas cuando el pago
                  esté al día.
                </FieldHint>

                <FormError>{preview.error}</FormError>

                {previewMatches ? (
                  preview.dates.length > 0 ? (
                    <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
                      <p className="text-xs text-muted-foreground">
                        Próximas fechas de {ruleLabel} ·{" "}
                        <span className="tnum font-medium text-foreground">{bookableDates}</span> de{" "}
                        <span className="tnum">{preview.dates.length}</span> se reservarían ahora
                      </p>
                      <ul className="grid gap-1.5 sm:grid-cols-2">
                        {preview.dates.map((date) => (
                          <li
                            key={date.slotOccurrenceId}
                            className="flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-1.5 text-sm"
                          >
                            <span className="tnum">
                              {dateFormatter.format(new Date(date.startAt))}
                            </span>
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

                      {/* Mismo form, misma acción que el botón de arriba:
                          después de leer el detalle no hay que volver a
                          subir para confirmar. */}
                      <Button
                        type="submit"
                        size="touch"
                        className="self-start"
                        disabled={createPending || previewPending}
                      >
                        {createPending ? "Asignando…" : "Confirmar horario fijo"}
                      </Button>
                    </div>
                  ) : (
                    <EmptyState
                      size="sm"
                      title="No hay próximas fechas publicadas para este horario."
                      description="Podés asignar el horario fijo igual: las fechas se confirman solas a medida que se publiquen."
                    />
                  )
                ) : null}

                <FormError>{created.error}</FormError>
                <FormSuccess>{created.success}</FormSuccess>
              </form>
            </>
          )}

          {available.length === 0 ? (
            <Button type="button" variant="ghost" size="touch" className="self-start" onClick={() => setOpen(false)}>
              Cerrar
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
