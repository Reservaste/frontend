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

export function OccurrenceActions({
  organizationSlug,
  occurrenceId,
  capacity,
  attendees,
  customers,
  isCancelled,
}: {
  organizationSlug: string;
  occurrenceId: string;
  capacity: number;
  attendees: OccurrenceAttendee[];
  customers: OrganizationCustomer[];
  isCancelled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [bookState, bookAction, booking] = useActionState(
    bookCustomerIntoSlot.bind(null, organizationSlug, occurrenceId),
    initialState,
  );
  const [capacityState, capacityAction, savingCapacity] = useActionState(
    updateOccurrenceCapacity.bind(null, organizationSlug, occurrenceId),
    initialState,
  );

  const confirmed = attendees.filter((a) => a.status === "CONFIRMED");

  if (!open) {
    return (
      <Button variant="ghost" size="xs" onClick={() => setOpen(true)}>
        Ver detalle
      </Button>
    );
  }

  return (
    <div className="mt-3 flex w-full flex-col gap-4 border-t pt-3">
      <div className="flex flex-col gap-2">
        <h4 className="text-xs font-medium text-muted-foreground">
          Anotados ({confirmed.length})
        </h4>
        {confirmed.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay nadie anotado.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {confirmed.map((attendee) => (
              <li key={attendee.bookingId} className="flex items-center justify-between text-sm">
                <span>{attendee.customerName}</span>
                {!isCancelled ? (
                  <form action={cancelBookingAsStaff.bind(null, organizationSlug, attendee.bookingId)}>
                    <Button type="submit" variant="ghost" size="xs">
                      Cancelar
                    </Button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {!isCancelled ? (
        <>
          <form action={bookAction} className="flex flex-wrap items-end gap-2">
            <div className="flex min-w-48 flex-1 flex-col gap-1">
              <label htmlFor={`customer-${occurrenceId}`} className="text-xs text-muted-foreground">
                Anotar cliente
              </label>
              <select
                id={`customer-${occurrenceId}`}
                name="customerId"
                className="h-8 rounded-md border bg-background px-2 text-sm"
                required
              >
                <option value="">Elegir…</option>
                {customers
                  .filter((c) => c.isActive)
                  .map((c) => (
                    <option key={c.customerId} value={c.customerId}>
                      {c.fullName}
                    </option>
                  ))}
              </select>
            </div>
            <Button type="submit" size="xs" disabled={booking}>
              {booking ? "Anotando…" : "Anotar"}
            </Button>
          </form>
          {bookState.error ? <p className="text-sm text-destructive">{bookState.error}</p> : null}
          {bookState.success ? <p className="text-sm text-muted-foreground">{bookState.success}</p> : null}

          <form action={capacityAction} className="flex flex-wrap items-end gap-2">
            <div className="flex w-32 flex-col gap-1">
              <label htmlFor={`capacity-${occurrenceId}`} className="text-xs text-muted-foreground">
                Capacidad
              </label>
              <Input
                id={`capacity-${occurrenceId}`}
                name="capacity"
                type="number"
                min={1}
                defaultValue={capacity}
                className="h-8"
              />
            </div>
            <Button type="submit" variant="outline" size="xs" disabled={savingCapacity}>
              {savingCapacity ? "Guardando…" : "Guardar"}
            </Button>
          </form>
          {capacityState.error ? <p className="text-sm text-destructive">{capacityState.error}</p> : null}

          <form action={cancelOccurrence.bind(null, organizationSlug, occurrenceId)}>
            <Button type="submit" variant="destructive" size="xs">
              Cancelar este horario
            </Button>
          </form>
        </>
      ) : null}

      <Button variant="ghost" size="xs" onClick={() => setOpen(false)}>
        Cerrar
      </Button>
    </div>
  );
}
