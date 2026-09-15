"use client";

import { useActionState, useState } from "react";
import { inviteMember, type ActionState } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ActionState = { error: null, success: null };

const selectClass =
  "h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function InviteForm({ organizationSlug }: { organizationSlug: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    inviteMember.bind(null, organizationSlug),
    initialState,
  );

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)} className="self-start">
        + Sumar a alguien
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-card">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" placeholder="persona@email.com" required autoFocus />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="role">Rol</Label>
          <select id="role" name="role" className={selectClass}>
            <option value="STAFF">STAFF</option>
            <option value="OWNER">OWNER</option>
          </select>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Sumando…" : "Sumar"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        STAFF gestiona la agenda y los clientes. OWNER además maneja el equipo y la configuración.
      </p>
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
