"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { Service } from "@reservaste/domain";
import { archiveService, updateService, type CreateServiceState } from "@/app/actions/services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
      <li className="bg-muted/40 px-4 py-3.5">
        <form action={formAction} className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`name-${service.id}`}>Nombre</Label>
              <Input id={`name-${service.id}`} name="name" defaultValue={service.name} required autoFocus />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`description-${service.id}`}>Descripción</Label>
              <Input
                id={`description-${service.id}`}
                name="description"
                defaultValue={service.description ?? ""}
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
                // A service carries bookings and payment history, so this
                // archives rather than deletes -- worth being explicit
                // about before it happens.
                if (!confirm(`¿Archivar "${service.name}"? Deja de publicarse y no se puede reservar más.`)) {
                  event.preventDefault();
                }
              }}
              formAction={archiveService.bind(null, organizationSlug, service.id)}
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
        <svg viewBox="0 0 24 24" fill="none" className="size-4">
          <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
    </li>
  );
}
