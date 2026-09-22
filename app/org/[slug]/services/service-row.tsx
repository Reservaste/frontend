"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { Service } from "@reservaste/domain";
import { archiveService, updateService, type CreateServiceState } from "@/app/actions/services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Field, FormError } from "@/components/ui/form";
import { ConfirmDialog } from "@/components/ui/dialog";
import { DataListRow } from "@/components/ui/table";
import { ChevronRight } from "@/components/icons";

const initialState: CreateServiceState = { error: null };

export function ServiceRow({ organizationSlug, service }: { organizationSlug: string; service: Service }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(
    updateService.bind(null, organizationSlug, service.id),
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
              <Label htmlFor={`name-${service.id}`}>Nombre</Label>
              <Input id={`name-${service.id}`} name="name" defaultValue={service.name} required autoFocus />
            </Field>
            <Field>
              <Label htmlFor={`description-${service.id}`}>Descripción</Label>
              <Input
                id={`description-${service.id}`}
                name="description"
                defaultValue={service.description ?? ""}
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
            {/* A service carries bookings and payment history, so this
                archives rather than deletes -- worth confirming before it
                happens. `ConfirmDialog` portals its content, so the nested
                `<form>` below never lands inside this row's own `<form>`. */}
            <ConfirmDialog
              trigger={
                <Button type="button" variant="ghost" size="sm" className="text-destructive">
                  Archivar
                </Button>
              }
              title={`¿Archivar "${service.name}"?`}
              description="Deja de publicarse y no se puede reservar más. Las reservas ya hechas se conservan."
            >
              <form action={archiveService.bind(null, organizationSlug, service.id)}>
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
      <Link
        href={`/org/${organizationSlug}/services/${service.id}/schedule`}
        className="flex min-w-0 flex-1 flex-col"
      >
        <span className="truncate font-medium">{service.name}</span>
        <span className="truncate text-sm text-muted-foreground">
          {service.description ?? "Configurar horarios"}
        </span>
      </Link>

      <Button variant="ghost" size="xs" onClick={() => setEditing(true)}>
        Editar
      </Button>
      <Link
        href={`/org/${organizationSlug}/services/${service.id}/schedule`}
        className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Ver horarios"
      >
        <ChevronRight />
      </Link>
    </DataListRow>
  );
}
