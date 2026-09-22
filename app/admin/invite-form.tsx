"use client";

import { useActionState } from "react";
import { createInvite, type PlatformActionState } from "@/app/actions/platform";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Field, FormError } from "@/components/ui/form";
import { Select } from "@/components/ui/select";

const initialState: PlatformActionState = { error: null, createdCode: null };

export function InviteForm({ plans }: { plans: { code: string; name: string; price: number }[] }) {
  const [state, formAction, pending] = useActionState(createInvite, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-card">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <Label htmlFor="planCode">Plan</Label>
          <Select id="planCode" name="planCode">
            {plans.map((plan) => (
              <option key={plan.code} value={plan.code}>
                {plan.name} · {plan.price} USD/mes
              </option>
            ))}
          </Select>
        </Field>
        <Field>
          <Label htmlFor="trialDays">Días de prueba (opcional)</Label>
          <Input id="trialDays" name="trialDays" type="number" min={1} placeholder="sin prueba" />
        </Field>
        <Field>
          <Label htmlFor="email">Reservar para un email (opcional)</Label>
          <Input id="email" name="email" type="email" placeholder="cliente@email.com" />
        </Field>
        <Field>
          <Label htmlFor="note">Nota interna (opcional)</Label>
          <Input id="note" name="note" type="text" placeholder="vendido por teléfono" />
        </Field>
      </div>

      {state.createdCode ? (
        <div className="flex flex-col gap-1 rounded-lg bg-success-subtle px-4 py-3">
          <span className="eyebrow text-success">Código generado</span>
          <span className="font-mono text-xl font-semibold tracking-widest text-success">
            {state.createdCode}
          </span>
          <span className="text-xs text-success">Pasáselo al cliente. Sirve una sola vez.</span>
        </div>
      ) : null}
      <FormError>{state.error}</FormError>

      <Button type="submit" size="sm" disabled={pending} className="self-start">
        {pending ? "Generando…" : "Generar código"}
      </Button>
    </form>
  );
}
