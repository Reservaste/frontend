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
import { Field, FormError, FormSuccess } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";

const initialState: ActionState = { error: null, success: null };

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
        className="focus-ring flex min-h-11 w-full items-center justify-center gap-1.5 border-t px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
        <h4 className="eyebrow text-muted-foreground">Anotados ({confirmed.length})</h4>
        {confirmed.length === 0 ? (
          <EmptyState size="sm" title="Todavía no hay nadie anotado." />
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
            <h4 className="eyebrow text-muted-foreground">Anotar cliente</h4>
            <form action={bookAction} className="flex flex-wrap items-center gap-2">
              <Select name="customerId" className="min-w-40 flex-1" required>
                <option value="">Elegir cliente…</option>
                {customers
                  .filter((c) => c.isActive)
                  .map((c) => (
                    <option key={c.customerId} value={c.customerId}>
                      {c.fullName}
                    </option>
                  ))}
              </Select>
              <Button type="submit" size="sm" disabled={booking}>
                {booking ? "Anotando…" : "Anotar"}
              </Button>
            </form>
            <FormError>{bookState.error}</FormError>
            <FormSuccess>{bookState.success}</FormSuccess>
          </section>

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
                  className="w-24"
                />
              </Field>
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
          <FormError>{capacityState.error}</FormError>
          <FormSuccess>{capacityState.success}</FormSuccess>
        </>
      ) : null}

      <button
        onClick={() => setOpen(false)}
        className="focus-ring self-center rounded-md px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        Cerrar
      </button>
    </div>
  );
}
