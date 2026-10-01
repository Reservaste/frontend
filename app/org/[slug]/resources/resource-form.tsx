"use client";

import { useActionState, useState } from "react";
import { createResource, type CreateResourceState } from "@/app/actions/resources";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Field, FormError } from "@/components/ui/form";

const initialState: CreateResourceState = { error: null };

export function ResourceForm({ organizationSlug }: { organizationSlug: string }) {
  const [open, setOpen] = useState(false);
  // Hidden input always carries "on"/"off" so an unchecked box still says
  // so explicitly -- same pattern as SettingsForm's makeup-credits toggle.
  const [isExclusive, setIsExclusive] = useState(false);
  const [state, formAction, pending] = useActionState(
    createResource.bind(null, organizationSlug),
    initialState,
  );

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)} className="self-start">
        + Nuevo recurso
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-card">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <Label htmlFor="name">Nombre</Label>
          <Input id="name" name="name" type="text" placeholder="Sala principal" required autoFocus />
        </Field>
        <Field>
          <Label htmlFor="description">Descripción (opcional)</Label>
          <Input id="description" name="description" type="text" placeholder="Capacidad 20 personas" />
        </Field>
      </div>

      <input type="hidden" name="isExclusive" value={isExclusive ? "on" : "off"} />
      <label className="flex w-full items-start gap-3 rounded-lg px-1 py-2 text-sm transition-colors hover:bg-muted/50">
        <input
          type="checkbox"
          checked={isExclusive}
          onChange={(event) => setIsExclusive(event.target.checked)}
          className="focus-ring mt-0.5 size-4 shrink-0 accent-primary"
        />
        <span className="flex flex-col gap-0.5">
          <span className="font-medium">Se ocupa de a uno (no admite turnos superpuestos)</span>
          <span className="text-xs text-muted-foreground">
            Para un profesional, una camilla o una cancha 1 a 1: nunca queda reservado dos veces a la
            misma hora, aunque sea en servicios distintos.
          </span>
        </span>
      </label>

      <FormError>{state.error}</FormError>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Creando…" : "Crear recurso"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
