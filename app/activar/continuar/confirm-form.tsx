"use client";

import { useActionState } from "react";
import { claimActivation, signOutForActivation, type ClaimActivationState } from "@/app/actions/activation";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form";

const initialState: ClaimActivationState = { error: null };

export function ConfirmActivationForm() {
  const [state, formAction, pending] = useActionState(async () => claimActivation(), initialState);

  return (
    <div className="flex flex-col gap-3">
      <form action={formAction}>
        <Button type="submit" size="touch" disabled={pending} className="w-full">
          {pending ? "Activando…" : "Confirmar y activar"}
        </Button>
      </form>
      <form action={signOutForActivation}>
        <Button type="submit" variant="ghost" size="sm" className="w-full">
          No soy yo — usar otra cuenta
        </Button>
      </form>
      <FormError>{state.error}</FormError>
    </div>
  );
}
