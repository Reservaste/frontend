"use client";

import { useActionState, useState } from "react";
import { createManagedCustomer, type ActionState } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Field, FieldHint, FormError, FormSuccess } from "@/components/ui/form";

const initialState: ActionState = { error: null, success: null };

/**
 * ADR-0026: alta de un cliente que no tiene (o no quiere crear todavía)
 * una cuenta -- el mostrador lo agenda y le cobra por nombre y teléfono, y
 * después le manda un link de WhatsApp para que active cuando quiera
 * (ver ActivationPanel en la ficha del cliente).
 */
export function ManagedCustomerForm({ organizationSlug }: { organizationSlug: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    createManagedCustomer.bind(null, organizationSlug),
    initialState,
  );

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)} className="self-start">
        + Cliente sin cuenta
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-card">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <Label htmlFor="displayName">Nombre</Label>
          <Input id="displayName" name="displayName" placeholder="Nombre y apellido" required autoFocus />
        </Field>
        <Field>
          <Label htmlFor="phone">Teléfono</Label>
          <Input id="phone" name="phone" type="tel" placeholder="+598 99 123 456" />
          <FieldHint>Con código de país. Hace falta para poder mandarle el link de activación.</FieldHint>
        </Field>
      </div>
      <FormError>{state.error}</FormError>
      <FormSuccess>{state.success}</FormSuccess>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar cliente"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cerrar
        </Button>
      </div>
    </form>
  );
}
