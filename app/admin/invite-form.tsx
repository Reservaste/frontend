"use client";

import { useActionState } from "react";
import { createInvite, type PlatformActionState } from "@/app/actions/platform";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: PlatformActionState = { error: null, createdCode: null };

const selectClass =
  "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function InviteForm({ plans }: { plans: { code: string; name: string; price: number }[] }) {
  const [state, formAction, pending] = useActionState(createInvite, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-card">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="planCode">Plan</Label>
          <select id="planCode" name="planCode" className={selectClass}>
            {plans.map((plan) => (
              <option key={plan.code} value={plan.code}>
                {plan.name} · {plan.price} USD/mes
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="trialDays">Días de prueba (opcional)</Label>
          <Input id="trialDays" name="trialDays" type="number" min={1} placeholder="sin prueba" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Reservar para un email (opcional)</Label>
          <Input id="email" name="email" type="email" placeholder="cliente@email.com" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="note">Nota interna (opcional)</Label>
          <Input id="note" name="note" type="text" placeholder="vendido por teléfono" />
        </div>
      </div>

      {state.createdCode ? (
        <div className="flex flex-col gap-1 rounded-lg bg-success-subtle px-4 py-3">
          <span className="text-xs font-medium uppercase tracking-wider text-success">
            Código generado
          </span>
          <span className="font-mono text-xl font-semibold tracking-widest text-success">
            {state.createdCode}
          </span>
          <span className="text-xs text-success">Pasáselo al cliente. Sirve una sola vez.</span>
        </div>
      ) : null}
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <Button type="submit" size="sm" disabled={pending} className="self-start">
        {pending ? "Generando…" : "Generar código"}
      </Button>
    </form>
  );
}
