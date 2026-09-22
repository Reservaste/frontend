"use client";

import { useActionState, useState } from "react";
import { createManagedCustomer, type ManagedCustomerState } from "@/app/actions/admin";
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

const initialState: ManagedCustomerState = { error: null, success: null };

/**
 * ADR-0026: alta de un cliente que no tiene (o no quiere crear todavía)
 * una cuenta -- el mostrador lo agenda y le cobra por nombre y teléfono.
 *
 * El teléfono es obligatorio a propósito: apenas se guarda, el mismo panel
 * pasa a mostrar el botón de WhatsApp ya armado -- "ya de una", sin tener
 * que cerrar esto, entrar a la ficha del cliente y buscar ahí el envío
 * (que sigue existiendo en `ActivationPanel` para reenviar más adelante).
 *
 * Same `Sheet` pattern as `EnrollForm` right next to this one on the same
 * screen -- two different "tap to add someone" gestures on one page had to
 * look identical or neither would.
 */
export function ManagedCustomerForm({ organizationSlug }: { organizationSlug: string }) {
  const [open, setOpen] = useState(false);
  // `useActionState`'s state has no reset API of its own and shouldn't be
  // mutated directly (React owns that reference) -- this flag is what lets
  // closing the sheet forget a previous success, so reopening it for the
  // next customer starts from the form instead of a stale "enviar" screen.
  const [dismissed, setDismissed] = useState(false);
  const [state, formAction, pending] = useActionState(
    createManagedCustomer.bind(null, organizationSlug),
    initialState,
  );

  // Not a popup opened after the fact -- browsers treat a Server Action's
  // response as arriving outside the original click's trusted-gesture
  // window, so `window.open` here would just get silently blocked in most
  // of them. A real, unmissable button the owner taps themselves is one
  // tap either way and never fails silently.
  const readyToSend = Boolean(state.success && state.whatsappUrl) && !dismissed;

  // One function for every way this sheet can close (backdrop click,
  // Escape, the "Listo" button) so `dismissed` can't be set through
  // `onOpenChange` while a direct `setOpen` call from a button skips it.
  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setDismissed(true);
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger render={<Button variant="outline" size="touch" className="self-start" />}>
        + Cliente sin cuenta
      </SheetTrigger>
      <SheetContent>
        {readyToSend ? (
          <>
            <SheetHeader>
              <SheetTitle>Cliente creado</SheetTitle>
              <SheetDescription>{state.success}</SheetDescription>
            </SheetHeader>
            <SheetBody>
              <a
                href={state.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-ring flex items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-3 text-center text-sm font-semibold text-white shadow-card transition-transform hover:scale-[1.01]"
              >
                Enviar mensaje de WhatsApp
              </a>
              <FieldHint className="mt-2">
                Se abre tu WhatsApp con el mensaje ya armado, listo para mandar al número que cargaste. Si
                no lo mandás ahora, podés hacerlo después desde la ficha del cliente.
              </FieldHint>
            </SheetBody>
            <SheetFooter>
              <Button size="touch" onClick={() => handleOpenChange(false)}>
                Listo
              </Button>
            </SheetFooter>
          </>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle>Cliente sin cuenta</SheetTitle>
              <SheetDescription>
                Lo agendás y le cobrás vos. Apenas lo guardes te llevo a mandarle el link de WhatsApp para
                que active su cuenta cuando quiera.
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
                  <Input
                    id="mc-phone"
                    name="phone"
                    type="tel"
                    placeholder="+598 99 123 456"
                    required
                    touch
                  />
                  <FieldHint>Con código de país. Es a donde le vas a mandar el link de activación.</FieldHint>
                </Field>
                <FormError>{state.error}</FormError>
                {state.success && !state.whatsappUrl ? <FormSuccess>{state.success}</FormSuccess> : null}
              </form>
            </SheetBody>
            <SheetFooter>
              <SheetClose render={<Button variant="ghost" size="touch" />}>Cerrar</SheetClose>
              <Button type="submit" form="managed-customer-form" size="touch" disabled={pending}>
                {pending ? "Guardando…" : "Guardar y enviar"}
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
