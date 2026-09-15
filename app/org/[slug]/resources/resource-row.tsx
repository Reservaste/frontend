"use client";

import { useActionState, useState } from "react";
import type { Resource } from "@reservaste/domain";
import { archiveResource, updateResource, type CreateResourceState } from "@/app/actions/resources";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: CreateResourceState = { error: null };

export function ResourceRow({ organizationSlug, resource }: { organizationSlug: string; resource: Resource }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(
    updateResource.bind(null, organizationSlug, resource.id),
    initialState,
  );

  // React's documented "adjust state during render" pattern: when the
  // action reports a save, collapse the row. An effect would work too but
  // schedules an extra render pass for something knowable right here.
  const [sawSave, setSawSave] = useState(state.saved);
  if (state.saved !== sawSave) {
    setSawSave(state.saved);
    if (state.saved) setEditing(false);
  }

  if (editing) {
    return (
      <li className="bg-muted/40 px-4 py-3.5">
        <form action={formAction} className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`name-${resource.id}`}>Nombre</Label>
              <Input id={`name-${resource.id}`} name="name" defaultValue={resource.name} required autoFocus />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`description-${resource.id}`}>Descripción</Label>
              <Input
                id={`description-${resource.id}`}
                name="description"
                defaultValue={resource.description ?? ""}
              />
            </div>
          </div>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Guardando…" : "Guardar"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
            <span className="flex-1" />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={(event) => {
                // Archives rather than deletes: schedules and their
                // generated history still point at this resource.
                if (!confirm(`¿Archivar "${resource.name}"? Los horarios que lo usan dejan de generar turnos.`)) {
                  event.preventDefault();
                }
              }}
              formAction={archiveResource.bind(null, organizationSlug, resource.id)}
            >
              Archivar
            </Button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-2 px-4 py-3.5">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{resource.name}</span>
        {resource.description ? (
          <span className="truncate text-sm text-muted-foreground">{resource.description}</span>
        ) : null}
      </div>

      <Button variant="ghost" size="xs" onClick={() => setEditing(true)}>
        Editar
      </Button>
    </li>
  );
}
