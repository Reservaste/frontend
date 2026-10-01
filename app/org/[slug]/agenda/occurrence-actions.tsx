"use client";

import { useActionState } from "react";
import type { OccurrenceAttendee, OrganizationCustomer } from "@/app/actions/admin";
import {
  bookCustomerIntoSlot,
  cancelBookingAsStaff,
  cancelOccurrence,
  chargeDropIn,
  updateOccurrenceCapacity,
  type ActionState,
} from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormError, FormSuccess } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { formatMoney } from "@/lib/money";

const initialState: ActionState = { error: null, success: null };

/** ADR-0046: one row's charge-dropin form, with its own error/success state. */
function ChargeDropInRow({
  organizationSlug,
  occurrenceId,
  customerId,
  label,
}: {
  organizationSlug: string;
  occurrenceId: string;
  customerId: string;
  label: string;
}) {
  const [state, action, charging] = useActionState(
    chargeDropIn.bind(null, organizationSlug, occurrenceId),
    initialState,
  );

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <input type="hidden" name="customerId" value={customerId} />
        <Button type="submit" variant="outline" size="touch" disabled={charging}>
          {charging ? "Cobrando…" : label}
        </Button>
      </div>
      <FormError>{state.error}</FormError>
      <FormSuccess>{state.success}</FormSuccess>
    </form>
  );
}

/**
 * The body of a turno's own detail page (`agenda/[occurrenceId]/page.tsx`,
 * the only caller). This used to also render a collapsed "Ver detalle"
 * toggle for an embedded, collapsible use that no call site ever exercised
 * — `alwaysOpen` was always `true` in practice, so that branch was dead
 * code. Removed rather than kept "for later": a props contract nobody
 * exercises is exactly the kind of thing that silently breaks.
 */
export function OccurrenceActions({
  organizationSlug,
  occurrenceId,
  capacity,
  attendees,
  customers,
  isCancelled,
  canManageBookings,
  canManagePayments,
  dropInPlanId,
  dropInPrice,
  dropInCurrency,
}: {
  organizationSlug: string;
  occurrenceId: string;
  capacity: number;
  attendees: OccurrenceAttendee[];
  customers: OrganizationCustomer[];
  isCancelled: boolean;
  /**
   * ADR-0033 `MANAGE_BOOKINGS`: "Anotar", removing someone else's booking
   * and cancelling the turno. Without it the attendee list stays visible
   * (a role that cannot see who is booked cannot run the turno).
   */
  canManageBookings: boolean;
  /** ADR-0033 `MANAGE_PAYMENTS`: required to see or use the charge-dropin actions. */
  canManagePayments: boolean;
  /** ADR-0046: null when this occurrence's service has no active DROP_IN plan -- hides everything below. */
  dropInPlanId: string | null;
  dropInPrice: number | null;
  dropInCurrency: string | null;
}) {
  const [bookState, bookAction, booking] = useActionState(
    bookCustomerIntoSlot.bind(null, organizationSlug, occurrenceId),
    initialState,
  );
  const [capacityState, capacityAction, savingCapacity] = useActionState(
    updateOccurrenceCapacity.bind(null, organizationSlug, occurrenceId),
    initialState,
  );
  const [chargeState, chargeAction, charging] = useActionState(
    chargeDropIn.bind(null, organizationSlug, occurrenceId),
    initialState,
  );

  const confirmed = attendees.filter((a) => a.status === "CONFIRMED");
  const canChargeDropIn = canManagePayments && dropInPlanId !== null;
  const dropInLabel =
    dropInPrice !== null && dropInCurrency !== null ? `Cobrar ${formatMoney(dropInPrice, dropInCurrency)}` : "Cobrar";

  return (
    <div className="flex flex-col gap-5 border-t bg-muted/40 px-4 py-4">
      <section className="flex flex-col gap-2">
        <h4 className="eyebrow text-muted-foreground">Anotados ({confirmed.length})</h4>
        {confirmed.length === 0 ? (
          <EmptyState size="sm" title="Todavía no hay nadie anotado." />
        ) : (
          <ul className="flex flex-col divide-y rounded-lg border bg-card">
            {confirmed.map((attendee) => (
              <li key={attendee.bookingId} className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="text-sm">{attendee.customerName}</span>
                <div className="flex items-center gap-2">
                  {!isCancelled && canChargeDropIn && attendee.paidPaymentId === null ? (
                    <ChargeDropInRow
                      organizationSlug={organizationSlug}
                      occurrenceId={occurrenceId}
                      customerId={attendee.customerId}
                      label={dropInLabel}
                    />
                  ) : null}
                  {!isCancelled && canManageBookings ? (
                    <form action={cancelBookingAsStaff.bind(null, organizationSlug, attendee.bookingId)}>
                      <Button type="submit" variant="ghost" size="touch">
                        Quitar
                      </Button>
                    </form>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!isCancelled ? (
        <>
          {canManageBookings ? (
          <section className="flex flex-col gap-2">
            <h4 className="eyebrow text-muted-foreground">Anotar cliente</h4>
            <form action={bookAction} className="flex flex-wrap items-center gap-2">
              <Select name="customerId" className="min-w-40 flex-1" touch required>
                <option value="">Elegir cliente…</option>
                {customers
                  .filter((c) => c.isActive)
                  .map((c) => (
                    <option key={c.customerId} value={c.customerId}>
                      {c.fullName}
                    </option>
                  ))}
              </Select>
              <Button type="submit" size="touch" disabled={booking}>
                {booking ? "Anotando…" : "Anotar"}
              </Button>
            </form>
            <FormError>{bookState.error}</FormError>
            <FormSuccess>{bookState.success}</FormSuccess>
          </section>
          ) : null}

          {canChargeDropIn ? (
          <section className="flex flex-col gap-2">
            <h4 className="eyebrow text-muted-foreground">Cobrar turno suelto</h4>
            <form action={chargeAction} className="flex flex-wrap items-center gap-2">
              <Select name="customerId" className="min-w-40 flex-1" touch required>
                <option value="">Elegir cliente…</option>
                {customers
                  .filter((c) => c.isActive)
                  .map((c) => (
                    <option key={c.customerId} value={c.customerId}>
                      {c.fullName}
                    </option>
                  ))}
              </Select>
              <Button type="submit" size="touch" disabled={charging}>
                {charging ? "Cobrando…" : dropInLabel}
              </Button>
            </form>
            <FormError>{chargeState.error}</FormError>
            <FormSuccess>{chargeState.success}</FormSuccess>
          </section>
          ) : null}

          <div className="flex flex-wrap items-end justify-between gap-3 border-t pt-4">
            <form action={capacityAction} className="flex items-end gap-2">
              <Field>
                <label htmlFor={`capacity-${occurrenceId}`} className="text-xs font-medium text-muted-foreground">
                  Capacidad
                </label>
                <Input
                  id={`capacity-${occurrenceId}`}
                  name="capacity"
                  type="number"
                  min={1}
                  defaultValue={capacity}
                  touch
                  className="w-24"
                />
              </Field>
              <Button type="submit" variant="outline" size="touch" disabled={savingCapacity}>
                {savingCapacity ? "Guardando…" : "Guardar"}
              </Button>
            </form>

            {canManageBookings ? (
              <form action={cancelOccurrence.bind(null, organizationSlug, occurrenceId)}>
                <Button type="submit" variant="destructive" size="touch">
                  Cancelar horario
                </Button>
              </form>
            ) : null}
          </div>
          <FormError>{capacityState.error}</FormError>
          <FormSuccess>{capacityState.success}</FormSuccess>
        </>
      ) : null}
    </div>
  );
}
