import type { OrganizationRole } from "@reservaste/domain";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Field, FieldHint } from "@/components/ui/form";
import { rolePermissionSummary } from "@/lib/role-labels";

/**
 * ADR-0033: `<select name="roleId">` with the organization's active roles,
 * preselected on the default one. Shared by both invitation forms so "which
 * role will this person get" reads the same in both.
 *
 * The default role travels as an empty value on purpose -- "no role of
 * their own", which the actions send as null. That keeps the person
 * following the organization's default if the owner later moves it,
 * instead of freezing today's default as an explicit assignment.
 */
export function RoleSelect({
  id,
  roles,
  disabled = false,
  hint,
}: {
  id: string;
  /** Active roles. */
  roles: OrganizationRole[];
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <Field>
      <Label htmlFor={id}>Rol</Label>
      <Select id={id} name="roleId" touch defaultValue="" disabled={disabled}>
        {roles.some((r) => r.isDefault) ? null : <option value="">Rol por defecto</option>}
        {roles.map((role) => (
          <option key={role.id} value={role.isDefault ? "" : role.id}>
            {role.name}
            {role.isDefault ? " (por defecto)" : ""} — {rolePermissionSummary(role)}
          </option>
        ))}
      </Select>
      <FieldHint>{hint ?? "Qué va a poder hacer. Lo podés cambiar después."}</FieldHint>
    </Field>
  );
}
