"use client";

import { useActionState } from "react";
import { inviteMember, type ActionState } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Field, FieldHint, FormError, FormSuccess } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetBody,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";

const initialState: ActionState = { error: null, success: null };

/** Same `Sheet` pattern as `customers/enroll-form.tsx` — see its comment. */
export function InviteForm({ organizationSlug }: { organizationSlug: string }) {
  const [state, formAction, pending] = useActionState(
    inviteMember.bind(null, organizationSlug),
    initialState,
  );

  return (
    <Sheet>
      <SheetTrigger render={<Button variant="outline" size="touch" className="self-start" />}>
        + Sumar a alguien
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Sumar a alguien al equipo</SheetTitle>
        </SheetHeader>
        <SheetBody>
          <form id="invite-form" action={formAction} className="flex flex-col gap-3">
            <Field>
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                name="email"
                type="email"
                placeholder="persona@email.com"
                required
                autoFocus
                touch
              />
            </Field>
            <Field>
              <Label htmlFor="invite-role">Rol</Label>
              <Select id="invite-role" name="role" touch>
                <option value="STAFF">Equipo</option>
                <option value="OWNER">Dueño</option>
              </Select>
              <FieldHint>
                Equipo gestiona la agenda y los clientes. Dueño además maneja el equipo y la configuración.
              </FieldHint>
            </Field>
            <FormError>{state.error}</FormError>
            <FormSuccess>{state.success}</FormSuccess>
          </form>
        </SheetBody>
        <SheetFooter>
          <SheetClose render={<Button variant="ghost" size="touch" />}>Cerrar</SheetClose>
          <Button type="submit" form="invite-form" size="touch" disabled={pending}>
            {pending ? "Sumando…" : "Sumar"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
