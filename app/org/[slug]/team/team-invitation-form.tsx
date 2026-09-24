"use client";

import { useActionState, useState } from "react";
import type { OrganizationRole } from "@reservaste/domain";
import { issueTeamInvitation, type IssueTeamInvitationState } from "@/app/actions/team-invitations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Field, FieldHint, FormError } from "@/components/ui/form";
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
import { IssuedInvitation } from "./issued-invitation";

const initialState: IssueTeamInvitationState = { error: null, success: null, invitation: null };

/**
 * ADR-0034: invite someone who has no account yet -- name + phone + email +
 * role, and a one-time link to send by WhatsApp.
 *
 * Deliberately a separate form from "Ya tiene cuenta" (`InviteForm`), chosen
 * by the owner: a single form that picked the path by itself would turn the
 * panel back into an oracle of "does this email have an account?" (ADR-0034
 * §5.6), and would blur "already inside" with "I sent a link that may not
 * arrive".
 *
 * The email is not optional and the form says why: it is the only thing the
 * redemption can verify.
 */
export function TeamInvitationForm({
  organizationSlug,
  roles,
  disabled,
}: {
  organizationSlug: string;
  /** Active roles, default first. */
  roles: OrganizationRole[];
  /** Plan is full, counting pending invitations. The page says why. */
  disabled: boolean;
}) {
  // Remounting the form on each opening resets both the fields and the
  // action state, so the one-time link from the previous invitation is
  // never shown again.
  const [session, setSession] = useState(0);
  const [open, setOpen] = useState(false);

  return (
    <Sheet
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (value) setSession((n) => n + 1);
      }}
    >
      <SheetTrigger render={<Button size="touch" disabled={disabled} />}>+ Invitar al equipo</SheetTrigger>
      <SheetContent>
        <InvitationFormBody key={session} organizationSlug={organizationSlug} roles={roles} />
      </SheetContent>
    </Sheet>
  );
}

function InvitationFormBody({
  organizationSlug,
  roles,
}: {
  organizationSlug: string;
  roles: OrganizationRole[];
}) {
  const [state, formAction, pending] = useActionState(
    issueTeamInvitation.bind(null, organizationSlug),
    initialState,
  );

  if (state.invitation) {
    return (
      <>
        <SheetHeader>
          <SheetTitle>Invitación lista</SheetTitle>
          <SheetDescription>
            Mandale el link. Cuando entre con el email que cargaste, va a quedar en el equipo.
          </SheetDescription>
        </SheetHeader>
        <SheetBody>
          <IssuedInvitation invitation={state.invitation} />
        </SheetBody>
        <SheetFooter>
          <SheetClose render={<Button variant="ghost" size="touch" />}>Listo</SheetClose>
        </SheetFooter>
      </>
    );
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>Invitar al equipo</SheetTitle>
        <SheetDescription>
          Para alguien que todavía no tiene cuenta. Le mandás un link por WhatsApp y entra con su email.
        </SheetDescription>
      </SheetHeader>
      <SheetBody>
        <form id="team-invitation-form" action={formAction} className="flex flex-col gap-3">
          <Field>
            <Label htmlFor="ti-name">Nombre</Label>
            <Input id="ti-name" name="displayName" required maxLength={120} autoComplete="off" touch autoFocus />
            <FieldHint>Para que lo reconozcas en la lista. No aparece en el mensaje.</FieldHint>
          </Field>
          <Field>
            <Label htmlFor="ti-phone">Teléfono</Label>
            <Input
              id="ti-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              placeholder="+598 99 123 456"
              autoComplete="off"
              touch
            />
            <FieldHint>Con código de país. Si lo dejás vacío, copiás el link y lo mandás vos.</FieldHint>
          </Field>
          <Field>
            <Label htmlFor="ti-email">Email</Label>
            <Input
              id="ti-email"
              name="email"
              type="email"
              required
              placeholder="persona@email.com"
              autoComplete="off"
              touch
              aria-describedby="ti-email-hint"
            />
            <FieldHint id="ti-email-hint">
              Con este email va a tener que entrar. Si se registra con otro (por ejemplo, con otra cuenta de
              Google), el link no le va a funcionar.
            </FieldHint>
          </Field>
          <RoleSelect id="ti-role" roles={roles} />
          <FormError>{state.error}</FormError>
        </form>
      </SheetBody>
      <SheetFooter>
        <SheetClose render={<Button variant="ghost" size="touch" />}>Cancelar</SheetClose>
        <Button type="submit" form="team-invitation-form" size="touch" disabled={pending}>
          {pending ? "Generando…" : "Generar invitación"}
        </Button>
      </SheetFooter>
    </>
  );
}
