"use client";

import { useActionState } from "react";
import { createResource, type CreateResourceState } from "@/app/actions/resources";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: CreateResourceState = { error: null };

export function ResourceForm({ organizationSlug }: { organizationSlug: string }) {
  const [state, formAction, pending] = useActionState(
    createResource.bind(null, organizationSlug),
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" name="name" type="text" placeholder="Sala principal" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="description">Descripción (opcional)</Label>
        <Input id="description" name="description" type="text" />
      </div>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" disabled={pending} size="sm">
        {pending ? "Creando..." : "Crear recurso"}
      </Button>
    </form>
  );
}
