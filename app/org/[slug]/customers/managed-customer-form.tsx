"use client";

import { useActionState } from "react";
import { createManagedCustomer, type ActionState } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Field, FieldHint, FormError, FormSuccess } from "@/components/ui/form";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";

const initialState: ActionState = { error: null, success: null };

/**
 * ADR-0026: alta de un cliente que no tiene (o no quiere crear todavía)
 * una cuenta -- el mostrador lo agenda y le cobra por nombre y teléfono, y
 * después le manda un link de WhatsApp para que active cuando quiera
 * (ver ActivationPanel en la ficha del cliente).
 *
 * Same `Sheet` pattern as `EnrollForm` right next to this one on the same
 * screen -- two different "tap to add someone" gestures on one page had to
 * look identical or neither would.
 */
export function ManagedCustomerForm({ organizationSlug }: { organizationSlug: string }) {
  const [state, formAction, pending] = useActionState(
    createManagedCustomer.bind(null, organizationSlug),
    initialState,
  );

  return (
    <Sheet>
      <SheetTrigger render={<Button variant="outline" size="touch" className="self-start" />}>
        + Cliente sin cuenta
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Cliente sin cuenta</SheetTitle>
          <SheetDescription>
            Lo agendás y le cobrás vos. Después le podés mandar un link de WhatsApp para que active su
            cuenta cuando quiera.
          </SheetDescription>
        </SheetHeader>
        <SheetBody>
          <form id="managed-customer-form" action={formAction} className="flex flex-col gap-3">
            <Field>
              <Label htmlFor="mc-displayName">Nombre</Label>
              <Input
                id="mc-displayName"
                name="displayName"
                placeholder="Nombre y apellido"
                required
                autoFocus
                touch
              />
            </Field>
            <Field>
              <Label htmlFor="mc-phone">Teléfono</Label>
              <Input id="mc-phone" name="phone" type="tel" placeholder="+598 99 123 456" touch />
              <FieldHint>Con código de país. Hace falta para poder mandarle el link de activación.</FieldHint>
            </Field>
            <FormError>{state.error}</FormError>
            <FormSuccess>{state.success}</FormSuccess>
          </form>
        </SheetBody>
        <SheetFooter>
          <SheetClose render={<Button variant="ghost" size="touch" />}>Cerrar</SheetClose>
          <Button type="submit" form="managed-customer-form" size="touch" disabled={pending}>
            {pending ? "Guardando…" : "Guardar cliente"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
