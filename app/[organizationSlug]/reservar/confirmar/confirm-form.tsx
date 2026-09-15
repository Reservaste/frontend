"use client";

import { useActionState } from "react";
import { confirmBooking, type BookingActionState } from "@/app/actions/customer";
import { Button } from "@/components/ui/button";

const initialState: BookingActionState = { error: null };

export function ConfirmForm({ slotOccurrenceId }: { slotOccurrenceId: string }) {
  const [state, formAction, pending] = useActionState(
    confirmBooking.bind(null, slotOccurrenceId),
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Confirmando…" : "Confirmar reserva"}
      </Button>
    </form>
  );
}
