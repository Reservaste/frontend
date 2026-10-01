"use client";

import { useActionState, useState } from "react";
import type { Resource } from "@reservaste/domain";
import { archiveResource, updateResource, type CreateResourceState } from "@/app/actions/resources";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Field, FormError } from "@/components/ui/form";
import { ConfirmDialog } from "@/components/ui/dialog";
import { DataListRow } from "@/components/ui/table";

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
      <DataListRow className="bg-muted/40 px-4 py-3.5">
        <form action={formAction} className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <Label htmlFor={`name-${resource.id}`}>Nombre</Label>
              <Input id={`name-${resource.id}`} name="name" defaultValue={resource.name} required autoFocus />
            </Field>
            <Field>
              <Label htmlFor={`description-${resource.id}`}>Descripción</Label>
              <Input
                id={`description-${resource.id}`}
                name="description"
                defaultValue={resource.description ?? ""}
              />
            </Field>
          </div>
          <FormError>{state.error}</FormError>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Guardando…" : "Guardar"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
            <span className="flex-1" />
            {/* Archives rather than deletes: schedules and their generated
                history still point at this resource. `ConfirmDialog` portals
                its content, so the nested `<form>` below never lands inside
                this row's own `<form>`. */}
            <ConfirmDialog
              trigger={
                <Button type="button" variant="ghost" size="sm" className="text-destructive">
                  Archivar
                </Button>
              }
              title={`¿Archivar "${resource.name}"?`}
              description="Los horarios que lo usan dejan de generar turnos. El historial se conserva."
            >
              <form action={archiveResource.bind(null, organizationSlug, resource.id)}>
                <Button type="submit" variant="destructive" className="w-full sm:w-auto">
                  Sí, archivar
                </Button>
              </form>
            </ConfirmDialog>
          </div>
        </form>
      </DataListRow>
    );
  }

  return (
    <DataListRow className="flex items-center gap-2 px-4 py-3.5">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{resource.name}</span>
        {resource.description ? (
          <span className="truncate text-sm text-muted-foreground">{resource.description}</span>
        ) : null}
      </div>

      <Button variant="ghost" size="xs" onClick={() => setEditing(true)}>
        Editar
      </Button>
    </DataListRow>
  );
}
