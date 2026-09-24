"use client";

import { useTransition } from "react";
import type { OrganizationRole } from "@reservaste/domain";
import { deactivateOrganizationRole, setOrganizationRoleDefault } from "@/app/actions/roles";
import type { ActionState } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { RoleForm } from "./role-form";

/**
 * Per-role actions for the owner: edit, make default, deactivate.
 *
 * "Desactivar" is never offered for the default role nor for a role someone
 * still has (docs/api.md, Fase 32) -- both are known without asking the
 * backend (`isDefault`, and the member count the page already computed), and
 * offering them would only be offering `DEFAULT_ROLE_REQUIRED` /
 * `ROLE_IN_USE`. Instead, the reason is said in place of the button.
 */
export function RoleActions({
  organizationSlug,
  role,
  memberCount,
}: {
  organizationSlug: string;
  role: OrganizationRole;
  memberCount: number;
}) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  const run = (action: () => Promise<ActionState>) => {
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        toast.add({ title: result.error, type: "error", timeout: 0, priority: "high" });
      } else if (result.success) {
        toast.add({ title: result.success, type: "success" });
      }
    });
  };

  const blockedReason = role.isDefault
    ? "Es el rol por defecto: elegí otro como defecto para poder desactivarlo."
    : memberCount > 0
      ? `Lo ${memberCount === 1 ? "tiene 1 persona" : `tienen ${memberCount} personas`}: cambiales el rol para poder desactivarlo.`
      : null;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <RoleForm
          organizationSlug={organizationSlug}
          role={role}
          trigger={
            <Button variant="outline" size="touch">
              Editar
            </Button>
          }
        />
        {!role.isDefault ? (
          <Button
            variant="ghost"
            size="touch"
            disabled={pending}
            onClick={() => run(() => setOrganizationRoleDefault(organizationSlug, role.id))}
          >
            Usar por defecto
          </Button>
        ) : null}
        {blockedReason === null ? (
          <ConfirmDialog
            trigger={
              <Button variant="ghost" size="touch" disabled={pending}>
                Desactivar
              </Button>
            }
            title={`¿Desactivar «${role.name}»?`}
            description="Deja de aparecer al invitar o al asignar un rol. Una invitación pendiente con este rol deja de funcionar: vas a tener que reenviarla con otro."
          >
            <Button
              variant="destructive"
              size="touch"
              className="w-full"
              disabled={pending}
              onClick={() => run(() => deactivateOrganizationRole(organizationSlug, role.id))}
            >
              Sí, desactivar
            </Button>
          </ConfirmDialog>
        ) : null}
      </div>
      {blockedReason ? <p className="text-xs text-muted-foreground">{blockedReason}</p> : null}
    </div>
  );
}
