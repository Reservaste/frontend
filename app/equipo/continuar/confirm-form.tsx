"use client";

import { useActionState } from "react";
import {
  claimTeamInvitation,
  signOutForTeamInvitation,
  type ClaimTeamInvitationState,
} from "@/app/actions/team-invitations";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form";

const initialState: ClaimTeamInvitationState = { error: null };

export function ConfirmTeamInvitationForm() {
  const [state, formAction, pending] = useActionState(async () => claimTeamInvitation(), initialState);

  return (
    <div className="flex flex-col gap-3">
      <form action={formAction}>
        <Button type="submit" size="touch" disabled={pending} className="w-full">
          {pending ? "Aceptando…" : "Aceptar invitación"}
        </Button>
      </form>
      <FormError>{state.error}</FormError>
      <form action={signOutForTeamInvitation}>
        <Button type="submit" variant="ghost" size="touch" className="w-full">
          Usar otra cuenta
        </Button>
      </form>
    </div>
  );
}
