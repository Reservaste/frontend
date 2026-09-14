"use client";

import { useActionState } from "react";
import { createService, type CreateServiceState } from "@/app/actions/services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: CreateServiceState = { error: null };

export function ServiceForm({ organizationSlug }: { organizationSlug: string }) {
  const [state, formAction, pending] = useActionState(
    createService.bind(null, organizationSlug),
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" name="name" type="text" placeholder="CrossFit" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="description">Descripción (opcional)</Label>
        <Input id="description" name="description" type="text" />
      </div>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" disabled={pending} size="sm">
        {pending ? "Creando..." : "Crear servicio"}
      </Button>
    </form>
  );
}
