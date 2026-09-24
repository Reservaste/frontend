"use client";

import { useActionState, useState } from "react";
import type { OrganizationRole } from "@reservaste/domain";
import { setMemberRole } from "@/app/actions/roles";
import type { ActionState } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { FormError } from "@/components/ui/form";

const initialState: ActionState = { error: null, success: null };

/**
 * ADR-0033: the configurable role of one STAFF member, for the owner.
 * Preselected on the member's *effective* role (`getTeam()` already resolves
 * "no role of their own" to the default), and saved with an explicit button
 * that only shows up once something changed -- a select that saves on change
 * is one mis-tap away from taking payments away from the cashier.
 */
export function MemberRoleSelect({
  organizationSlug,
  memberId,
  memberName,
  currentRoleId,
  roles,
}: {
  organizationSlug: string;
  memberId: string;
  memberName: string;
  currentRoleId: string | null;
  /** Active roles only. */
  roles: OrganizationRole[];
}) {
  const [state, formAction, pending] = useActionState(setMemberRole.bind(null, organizationSlug), initialState);
  const [value, setValue] = useState(currentRoleId ?? "");
  const dirty = value !== (currentRoleId ?? "");

  return (
    <form action={formAction} className="flex flex-col gap-1">
      <input type="hidden" name="memberId" value={memberId} />
      <div className="flex items-center gap-2">
        <Select
          name="roleId"
          touch
          aria-label={`Rol de ${memberName}`}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="w-auto min-w-36"
        >
          {/* An effective role that was deactivated is still what they have
              until someone changes it -- show it rather than silently
              displaying another option as if it were theirs. */}
          {currentRoleId && !roles.some((r) => r.id === currentRoleId) ? (
            <option value={currentRoleId}>Rol desactivado</option>
          ) : null}
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
              {role.isDefault ? " (por defecto)" : ""}
            </option>
          ))}
        </Select>
        {dirty ? (
          <Button type="submit" size="touch" disabled={pending}>
            {pending ? "Guardando…" : "Guardar"}
          </Button>
        ) : null}
      </div>
      <FormError>{state.error}</FormError>
    </form>
  );
}
