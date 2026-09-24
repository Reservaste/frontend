"use client";

import { useActionState, useState } from "react";
import type { OrganizationPermissions, OrganizationRole, OrgPermission } from "@reservaste/domain";
import { ALL_ORG_PERMISSIONS, ORG_PERMISSION_KEYS } from "@reservaste/domain";
import { createOrganizationRole, updateOrganizationRole } from "@/app/actions/roles";
import type { ActionState } from "@/app/actions/admin";
import { PERMISSION_COPY } from "@/lib/role-labels";
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
import { useToast } from "@/components/ui/toast";

const initialState: ActionState = { error: null, success: null };

const ORDER: OrgPermission[] = [
  "VIEW_PAYMENTS",
  "MANAGE_PAYMENTS",
  "MANAGE_BOOKINGS",
  "MANAGE_CUSTOMERS",
  "MANAGE_ATTENDANCE",
];

/**
 * ADR-0033: create or edit a configurable role.
 *
 * The five permissions are controlled state, and what travels in the
 * FormData is one hidden `on` per granted permission -- never the visible
 * checkboxes themselves. Two reasons: a *disabled* checkbox is not
 * submitted (and "ver pagos" is disabled while "registrar pagos" is on, so
 * it would arrive as off and the database would reject the role), and on
 * edit an absent field means "off", not "leave it" (docs/api.md, Fase 32).
 *
 * `MANAGE_PAYMENTS` implies `VIEW_PAYMENTS`: ticking "registrar" ticks and
 * locks "ver"; unticking "ver" unticks "registrar". There is a CHECK in the
 * database and a Zod refine, but the form should not be able to reach that
 * state in the first place.
 */
export function RoleForm({
  organizationSlug,
  role,
  trigger,
}: {
  organizationSlug: string;
  /** Absent = create. */
  role?: OrganizationRole;
  trigger: React.ReactElement;
}) {
  const editing = Boolean(role);
  const action = editing ? updateOrganizationRole : createOrganizationRole;
  const [open, setOpen] = useState(false);
  const toast = useToast();
  // Closing happens inside the action, on its own result -- not in an
  // effect watching the state (which would be a setState-in-effect).
  const [state, formAction, pending] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      const result = await action(organizationSlug, prev, formData);
      if (result.success) {
        setOpen(false);
        toast.add({ title: result.success, type: "success" });
      }
      return result;
    },
    initialState,
  );

  // New roles start with all five on: creating a role without thinking
  // reproduces today's behaviour and never leaves someone unable to work.
  const initialPerms = (): OrganizationPermissions =>
    role
      ? {
          canViewPayments: role.canViewPayments,
          canManagePayments: role.canManagePayments,
          canManageBookings: role.canManageBookings,
          canManageCustomers: role.canManageCustomers,
          canManageAttendance: role.canManageAttendance,
        }
      : { ...ALL_ORG_PERMISSIONS };
  const [perms, setPerms] = useState<OrganizationPermissions>(initialPerms);

  const toggle = (permission: OrgPermission, checked: boolean) => {
    setPerms((current) => {
      const next = { ...current, [ORG_PERMISSION_KEYS[permission]]: checked };
      if (permission === "MANAGE_PAYMENTS" && checked) next.canViewPayments = true;
      if (permission === "VIEW_PAYMENTS" && !checked) next.canManagePayments = false;
      return next;
    });
  };

  const formId = role ? `role-form-${role.id}` : "role-form-new";

  return (
    <Sheet
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        // Every opening starts from the saved role (or all-on for a new
        // one), not from whatever was ticked before a cancel.
        if (value) setPerms(initialPerms());
      }}
    >
      <SheetTrigger render={trigger} />
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{editing ? `Editar "${role?.name}"` : "Nuevo rol"}</SheetTitle>
          <SheetDescription>
            Lo que no está en esta lista lo puede ver cualquiera del equipo (la agenda, el padrón, los horarios)
            o lo maneja sólo el dueño (planes, precios, equipo y configuración).
          </SheetDescription>
        </SheetHeader>
        <SheetBody>
          <form id={formId} action={formAction} className="flex flex-col gap-4">
            {role ? <input type="hidden" name="roleId" value={role.id} /> : null}
            {ORDER.map((permission) =>
              perms[ORG_PERMISSION_KEYS[permission]] ? (
                <input key={permission} type="hidden" name={ORG_PERMISSION_KEYS[permission]} value="on" />
              ) : null,
            )}

            <Field>
              <Label htmlFor={`${formId}-name`}>Nombre</Label>
              <Input
                id={`${formId}-name`}
                name="name"
                defaultValue={role?.name ?? ""}
                placeholder="Recepción, Profesor, Caja…"
                required
                maxLength={60}
                touch
              />
              <FieldHint>Como lo van a ver vos y tu equipo.</FieldHint>
            </Field>

            <fieldset className="flex flex-col gap-1">
              <legend className="mb-1 text-sm font-medium">Qué puede hacer</legend>
              {ORDER.map((permission) => {
                const key = ORG_PERMISSION_KEYS[permission];
                const locked = permission === "VIEW_PAYMENTS" && perms.canManagePayments;
                const inputId = `${formId}-${permission}`;
                return (
                  <label
                    key={permission}
                    htmlFor={inputId}
                    className="flex min-h-11 w-full items-start gap-3 rounded-lg px-1 py-2 text-sm transition-colors hover:bg-muted/50"
                  >
                    <input
                      id={inputId}
                      type="checkbox"
                      checked={perms[key]}
                      disabled={locked}
                      onChange={(event) => toggle(permission, event.target.checked)}
                      className="focus-ring mt-0.5 size-5 shrink-0 accent-primary sm:size-4"
                    />
                    <span className="flex flex-col gap-0.5">
                      <span className="font-medium">{PERMISSION_COPY[permission].label}</span>
                      <span className="text-xs text-muted-foreground">
                        {locked ? "Incluido porque puede registrar pagos." : PERMISSION_COPY[permission].hint}
                      </span>
                    </span>
                  </label>
                );
              })}
            </fieldset>

            <FormError>{state.error}</FormError>
          </form>
        </SheetBody>
        <SheetFooter>
          <SheetClose render={<Button variant="ghost" size="touch" />}>Cancelar</SheetClose>
          <Button type="submit" form={formId} size="touch" disabled={pending}>
            {pending ? "Guardando…" : editing ? "Guardar cambios" : "Crear rol"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
