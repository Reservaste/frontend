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
 * ADR-0034: invite someone to the team -- name + phone + email + role, and
 * a one-time link to send by WhatsApp. Works whether or not the person has
 * an account already: entering with the invited email is what the
 * redemption checks, not whether that email was already registered.
 *
 * The only path left on this screen since ADR-0043's post-review
 * correction: the old synchronous "Ya tiene cuenta" form
 * (`invite_member_by_email()`) gave membership to whoever had that email
 * registered, with no proof it was the real person -- its `grant execute`
 * was revoked. This is the sole way to add someone now.
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
