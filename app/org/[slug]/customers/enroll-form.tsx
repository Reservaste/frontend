"use client";

import { useActionState } from "react";
import { enrollCustomer, type ActionState } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ActionState = { error: null, success: null };

export function EnrollForm({ organizationSlug }: { organizationSlug: string }) {
  const [state, formAction, pending] = useActionState(
    enrollCustomer.bind(null, organizationSlug),
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Habilitar cliente por email</Label>
        <Input id="email" name="email" type="email" placeholder="persona@email.com" required />
        <p className="text-xs text-muted-foreground">
          La persona tiene que tener cuenta creada. Si todavía no se registró, pedile que lo haga primero.
        </p>
      </div>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-muted-foreground">{state.success}</p> : null}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Habilitando…" : "Habilitar"}
      </Button>
    </form>
  );
}
