"use client";

import { useActionState } from "react";
import { confirmBooking, type BookingActionState } from "@/app/actions/customer";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form";

const initialState: BookingActionState = { error: null };

export function ConfirmForm({ slotOccurrenceId }: { slotOccurrenceId: string }) {
  const [state, formAction, pending] = useActionState(
    confirmBooking.bind(null, slotOccurrenceId),
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormError>{state.error}</FormError>
      <Button type="submit" size="touch" disabled={pending} className="w-full">
        {pending ? "Confirmando…" : "Confirmar reserva"}
      </Button>
    </form>
  );
}
