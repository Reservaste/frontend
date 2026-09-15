"use client";

import { useActionState, useState } from "react";
import { enrollCustomer, type ActionState } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ActionState = { error: null, success: null };

export function EnrollForm({ organizationSlug }: { organizationSlug: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    enrollCustomer.bind(null, organizationSlug),
    initialState,
  );

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)} className="self-start">
        + Habilitar cliente
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-card">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email de la persona</Label>
        <div className="flex flex-wrap gap-2">
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="persona@email.com"
            required
            autoFocus
            className="min-w-48 flex-1"
          />
          <Button type="submit" disabled={pending}>
            {pending ? "Habilitando…" : "Habilitar"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Tiene que tener cuenta creada. Si todavía no se registró, pedile que lo haga primero.
        </p>
      </div>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-success">{state.success}</p> : null}
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="self-start text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        Cerrar
      </button>
    </form>
  );
}
