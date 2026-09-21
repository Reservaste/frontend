"use client";

import { useActionState, useState } from "react";
import type { OccurrenceAttendee, OrganizationCustomer } from "@/app/actions/admin";
import {
  bookCustomerIntoSlot,
  cancelBookingAsStaff,
  cancelOccurrence,
  updateOccurrenceCapacity,
  type ActionState,
} from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: ActionState = { error: null, success: null };

const selectClass =
  "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function OccurrenceActions({
  organizationSlug,
  occurrenceId,
  capacity,
  attendees,
  customers,
  isCancelled,
  alwaysOpen = false,
}: {
  organizationSlug: string;
  occurrenceId: string;
  capacity: number;
  attendees: OccurrenceAttendee[];
  customers: OrganizationCustomer[];
  isCancelled: boolean;
  /** On the occurrence's own page there is nothing to collapse into. */
  alwaysOpen?: boolean;
}) {
  const [open, setOpen] = useState(alwaysOpen);
  const [bookState, bookAction, booking] = useActionState(
    bookCustomerIntoSlot.bind(null, organizationSlug, occurrenceId),
    initialState,
  );
  const [capacityState, capacityAction, savingCapacity] = useActionState(
    updateOccurrenceCapacity.bind(null, organizationSlug, occurrenceId),
    initialState,
  );

  const confirmed = attendees.filter((a) => a.status === "CONFIRMED");

  if (!open && !alwaysOpen) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-1.5 border-t px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        {confirmed.length > 0 ? `Ver ${confirmed.length} anotado${confirmed.length === 1 ? "" : "s"}` : "Ver detalle"}
        <svg viewBox="0 0 24 24" fill="none" className="size-3.5">
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-5 border-t bg-muted/40 px-4 py-4">
      <section className="flex flex-col gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Anotados ({confirmed.length})
        </h4>
        {confirmed.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay nadie anotado.</p>
        ) : (
          <ul className="flex flex-col divide-y rounded-lg border bg-card">
            {confirmed.map((attendee) => (
              <li key={attendee.bookingId} className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="text-sm">{attendee.customerName}</span>
                {!isCancelled ? (
                  <form action={cancelBookingAsStaff.bind(null, organizationSlug, attendee.bookingId)}>
                    <Button type="submit" variant="ghost" size="xs">
                      Quitar
                    </Button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {!isCancelled ? (
        <>
          <section className="flex flex-col gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Anotar cliente
            </h4>
            <form action={bookAction} className="flex flex-wrap items-center gap-2">
              <select name="customerId" className={`${selectClass} min-w-40 flex-1`} required>
                <option value="">Elegir cliente…</option>
                {customers
                  .filter((c) => c.isActive)
                  .map((c) => (
                    <option key={c.customerId} value={c.customerId}>
                      {c.fullName}
                    </option>
                  ))}
              </select>
              <Button type="submit" size="sm" disabled={booking}>
                {booking ? "Anotando…" : "Anotar"}
              </Button>
            </form>
            {bookState.error ? <p className="text-sm text-destructive">{bookState.error}</p> : null}
            {bookState.success ? <p className="text-sm text-success">{bookState.success}</p> : null}
          </section>

          <div className="flex flex-wrap items-end justify-between gap-3 border-t pt-4">
            <form action={capacityAction} className="flex items-end gap-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`capacity-${occurrenceId}`} className="text-xs font-medium text-muted-foreground">
                  Capacidad
                </label>
                <Input
                  id={`capacity-${occurrenceId}`}
                  name="capacity"
                  type="number"
                  min={1}
                  defaultValue={capacity}
                  className="h-9 w-24"
                />
              </div>
              <Button type="submit" variant="outline" size="sm" disabled={savingCapacity}>
                {savingCapacity ? "Guardando…" : "Guardar"}
              </Button>
            </form>

            <form action={cancelOccurrence.bind(null, organizationSlug, occurrenceId)}>
              <Button type="submit" variant="destructive" size="sm">
                Cancelar horario
              </Button>
            </form>
          </div>
          {capacityState.error ? <p className="text-sm text-destructive">{capacityState.error}</p> : null}
          {capacityState.success ? <p className="text-sm text-success">{capacityState.success}</p> : null}
        </>
      ) : null}

      <button
        onClick={() => setOpen(false)}
        className="self-center text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        Cerrar
      </button>
    </div>
  );
}
