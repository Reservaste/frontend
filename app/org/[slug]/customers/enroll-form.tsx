"use client";

import { useActionState } from "react";
import { enrollCustomer, type ActionState } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Field, FormError, FormSuccess } from "@/components/ui/form";
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
 * A `Sheet` instead of the form expanding in place: this, `InviteForm`
 * (×2) and the old `OccurrenceActions` toggle were four variants of the
 * same "tap to reveal a short form" gesture, each with its own hand-rolled
 * `Cerrar` link. One primitive for it means a phone gets a real bottom
 * sheet (thumb-reachable footer, swipe-to-dismiss) instead of the page
 * reflowing under a form that pushed the rest of the list down.
 */
export function EnrollForm({ organizationSlug }: { organizationSlug: string }) {
  const [state, formAction, pending] = useActionState(
    enrollCustomer.bind(null, organizationSlug),
    initialState,
  );

  return (
    <Sheet>
      {/* variant="ghost", no "outline" como el de al lado: son dos
          caminos válidos, pero uno de los dos no exige nada de la
          persona y tiene que verse como la opción por default (ADR-0026). */}
      <SheetTrigger render={<Button variant="ghost" size="touch" className="self-start" />}>
        + Cliente con cuenta existente
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Cliente con cuenta existente</SheetTitle>
          <SheetDescription>
            Solo si la persona ya se registró por su cuenta. Si no tiene cuenta todavía, cerrá esto y usá
            &quot;Cliente sin cuenta&quot; -- no hace falta que se registre antes.
          </SheetDescription>
        </SheetHeader>
        <SheetBody>
          <form id="enroll-form" action={formAction} className="flex flex-col gap-3">
            <Field>
              <Label htmlFor="enroll-email">Email de la persona</Label>
              <Input
                id="enroll-email"
                name="email"
                type="email"
                placeholder="persona@email.com"
                required
                autoFocus
                touch
              />
            </Field>
            <FormError>{state.error}</FormError>
            <FormSuccess>{state.success}</FormSuccess>
          </form>
        </SheetBody>
        <SheetFooter>
          <SheetClose render={<Button variant="ghost" size="touch" />}>Cerrar</SheetClose>
          <Button type="submit" form="enroll-form" size="touch" disabled={pending}>
            {pending ? "Habilitando…" : "Habilitar"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
