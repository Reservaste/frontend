"use client";

import { useActionState, useState } from "react";
import { inviteMember, type ActionState } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Field, FieldHint, FormError, FormSuccess } from "@/components/ui/form";
import { Select } from "@/components/ui/select";

const initialState: ActionState = { error: null, success: null };

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
        <Field>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" placeholder="persona@email.com" required autoFocus />
        </Field>
        <Field>
          <Label htmlFor="role">Rol</Label>
          <Select id="role" name="role">
            <option value="STAFF">Equipo</option>
            <option value="OWNER">Dueño</option>
          </Select>
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? "Sumando…" : "Sumar"}
        </Button>
      </div>
      <FieldHint>
        Equipo gestiona la agenda y los clientes. Dueño además maneja el equipo y la configuración.
      </FieldHint>
      <FormError>{state.error}</FormError>
      <FormSuccess>{state.success}</FormSuccess>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="focus-ring self-start rounded-md text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        Cerrar
      </button>
    </form>
  );
}
