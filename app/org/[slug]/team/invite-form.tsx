"use client";

import { useActionState } from "react";
import { inviteMember, type ActionState } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ActionState = { error: null, success: null };

export function InviteForm({ organizationSlug }: { organizationSlug: string }) {
  const [state, formAction, pending] = useActionState(
    inviteMember.bind(null, organizationSlug),
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Sumar a alguien al equipo</Label>
          <Input id="email" name="email" type="email" placeholder="persona@email.com" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="role">Rol</Label>
          <select id="role" name="role" className="h-9 rounded-md border bg-background px-3 text-sm">
            <option value="STAFF">STAFF</option>
            <option value="OWNER">OWNER</option>
          </select>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Solo un OWNER puede sumar gente. La persona tiene que tener cuenta creada.
      </p>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-muted-foreground">{state.success}</p> : null}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Sumando…" : "Sumar al equipo"}
      </Button>
    </form>
  );
}
