"use client";

import { useActionState } from "react";
import { createOrganization, type CreateOrganizationState } from "@/app/actions/organizations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TimezonePicker } from "@/components/timezone-picker";
import { FormError } from "@/components/ui/form";

const initialState: CreateOrganizationState = { error: null };

export function OnboardingForm() {
  const [state, formAction, pending] = useActionState(createOrganization, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="inviteCode">Código de invitación</Label>
        <Input
          id="inviteCode"
          name="inviteCode"
          type="text"
          placeholder="ABCD234XYZ"
          required
          autoCapitalize="characters"
          className="font-mono tracking-widest uppercase"
        />
        <p className="text-xs text-muted-foreground">
          Te lo damos al contratar el plan. Si no tenés uno, escribinos.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Nombre del negocio</Label>
        <Input id="name" name="name" type="text" placeholder="Iron Gym" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="slug">URL pública</Label>
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <span>reservaste.app/</span>
          <Input id="slug" name="slug" type="text" placeholder="iron-gym" required className="flex-1" />
        </div>
      </div>
      <TimezonePicker />
      <FormError>{state.error}</FormError>
      <Button type="submit" size="touch" disabled={pending} className="w-full">
        {pending ? "Creando..." : "Crear organización"}
      </Button>
    </form>
  );
}
