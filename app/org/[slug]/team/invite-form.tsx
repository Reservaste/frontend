"use client";

import { useActionState, useState } from "react";
import type { OrganizationRole } from "@reservaste/domain";
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
  SheetDescription,
  SheetBody,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import { RoleSelect } from "./role-select";

const initialState: ActionState = { error: null, success: null };

/**
 * "Ya tiene cuenta": the synchronous path (`inviteMember`), kept on purpose
 * by ADR-0034 resolution 1 and chosen explicitly by the owner -- never
 * picked automatically, which would reintroduce the "is this email
 * registered?" oracle. Same `Sheet` pattern as `customers/enroll-form.tsx`.
 *
 * ADR-0033: gains the configurable role select, disabled when "Dueño" is
 * chosen -- an OWNER carries no configurable role (the RPC ignores it).
 */
export function InviteForm({
  organizationSlug,
  roles,
  disabled,
}: {
  organizationSlug: string;
  roles: OrganizationRole[];
  disabled: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    inviteMember.bind(null, organizationSlug),
    initialState,
  );
  const [baseRole, setBaseRole] = useState<"STAFF" | "OWNER">("STAFF");

  return (
    <Sheet>
      <SheetTrigger render={<Button variant="outline" size="touch" disabled={disabled} />}>
        Ya tiene cuenta
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Sumar a alguien que ya tiene cuenta</SheetTitle>
          <SheetDescription>
            Queda en el equipo en el acto. Si todavía no tiene cuenta, usá “Invitar al equipo”.
          </SheetDescription>
        </SheetHeader>
        <SheetBody>
          <form id="invite-form" action={formAction} className="flex flex-col gap-3">
            <Field>
              <Label htmlFor="invite-email">Email de su cuenta</Label>
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
              <Label htmlFor="invite-role">Tipo de acceso</Label>
              <Select
                id="invite-role"
                name="role"
                touch
                value={baseRole}
                onChange={(event) => setBaseRole(event.target.value as "STAFF" | "OWNER")}
              >
                <option value="STAFF">Equipo</option>
                <option value="OWNER">Dueño</option>
              </Select>
              <FieldHint>
                Dueño puede todo, incluido el equipo, los roles, los planes y la configuración.
              </FieldHint>
            </Field>
            <RoleSelect
              id="invite-role-id"
              roles={roles}
              disabled={baseRole === "OWNER"}
              hint={baseRole === "OWNER" ? "El dueño no lleva rol: siempre puede todo." : undefined}
            />
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
