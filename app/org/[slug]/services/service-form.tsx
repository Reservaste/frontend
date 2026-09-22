"use client";

import { useActionState, useState } from "react";
import { createService, type CreateServiceState } from "@/app/actions/services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Field, FormError } from "@/components/ui/form";

const initialState: CreateServiceState = { error: null };

export function ServiceForm({ organizationSlug }: { organizationSlug: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    createService.bind(null, organizationSlug),
    initialState,
  );

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)} className="self-start">
        + Nuevo servicio
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-card">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <Label htmlFor="name">Nombre</Label>
          <Input id="name" name="name" type="text" placeholder="CrossFit" required autoFocus />
        </Field>
        <Field>
          <Label htmlFor="description">Descripción (opcional)</Label>
          <Input id="description" name="description" type="text" placeholder="Clase grupal de 60 min" />
        </Field>
      </div>
      <FormError>{state.error}</FormError>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Creando…" : "Crear servicio"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
