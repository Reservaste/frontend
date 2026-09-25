"use client";

import { useActionState, useState } from "react";
import { createInvite, type PlatformActionState } from "@/app/actions/platform";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Field, FormError } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import { CheckIcon, CopyIcon } from "@/components/icons";

const initialState: PlatformActionState = { error: null, createdCode: null };

/** Copies the freshly generated invite code -- the whole point of this
 * field is to paste it straight into WhatsApp or an email a moment later,
 * and retyping a 10-character code by hand is exactly the kind of friction
 * this button exists to remove. Local `copied` state only, no toast: the
 * button's own label already confirms it. */
export function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      size="touch"
      onClick={async () => {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? <CheckIcon className="text-success" /> : <CopyIcon />}
      {copied ? "Copiado" : "Copiar"}
    </Button>
  );
}

export function InviteForm({ plans }: { plans: { code: string; name: string; price: number }[] }) {
  const [state, formAction, pending] = useActionState(createInvite, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-card">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <Label htmlFor="planCode">Plan</Label>
          <Select id="planCode" name="planCode" touch>
            {plans.map((plan) => (
              <option key={plan.code} value={plan.code}>
                {plan.name} · {plan.price} USD/mes
              </option>
            ))}
          </Select>
        </Field>
        <Field>
          <Label htmlFor="trialDays">Días de prueba (opcional)</Label>
          <Input id="trialDays" name="trialDays" type="number" min={1} placeholder="sin prueba" touch />
        </Field>
        <Field>
          <Label htmlFor="email">Reservar para un email (opcional)</Label>
          <Input id="email" name="email" type="email" placeholder="cliente@email.com" touch />
        </Field>
        <Field>
          <Label htmlFor="note">Nota interna (opcional)</Label>
          <Input id="note" name="note" type="text" placeholder="vendido por teléfono" touch />
        </Field>
      </div>

      {state.createdCode ? (
        <div className="flex flex-col gap-2 rounded-lg bg-success-subtle px-4 py-3">
          <span className="eyebrow text-success-on-subtle">Código generado</span>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xl font-semibold tracking-widest text-success-on-subtle">
              {state.createdCode}
            </span>
            <CopyCodeButton code={state.createdCode} />
          </div>
          <span className="text-xs text-success-on-subtle">Pasáselo al cliente. Sirve una sola vez.</span>
        </div>
      ) : null}
      <FormError>{state.error}</FormError>

      <Button type="submit" size="touch" disabled={pending} className="self-start">
        {pending ? "Generando…" : "Generar código"}
      </Button>
    </form>
  );
}
