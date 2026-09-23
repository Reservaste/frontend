"use client";

import { useState, useTransition } from "react";
import { setSubscription, type PlatformOrganization } from "@/app/actions/platform";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { FormError } from "@/components/ui/form";

const STATUSES = [
  { value: "ACTIVE", label: "Activar" },
  { value: "PAST_DUE", label: "Marcar impago" },
  { value: "SUSPENDED", label: "Suspender" },
] as const;

/**
 * Suspend/reactivate cut off (or restore) an organization's access to its
 * own panel and public calendar -- not something to fire from a bare
 * `onClick`. Both go through `ConfirmDialog`, kept open while the request is
 * in flight and only closed on success (dialog.tsx: "an uncontrolled dialog
 * does not close by itself" -- driving `open` ourselves is what lets the
 * dialog stay open to show the error instead of silently doing nothing).
 * "Marcar impago" and the plan switches are reversible/low-stakes enough to
 * stay a direct button, but still share the same pending/error handling: a
 * silent failure here is a client who thinks they were suspended, or a
 * suspension that silently didn't happen.
 */
export function SubscriptionControls({
  organization,
  plans,
}: {
  organization: PlatformOrganization;
  plans: { code: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState<string | null>(null);

  const run = (planCode: string, status: string, key: string, closeOnSuccess?: string) => {
    setError(null);
    setPendingKey(key);
    startTransition(async () => {
      const result = await setSubscription(organization.organizationId, planCode, status);
      setPendingKey(null);
      if (result?.error) {
        setError(result.error);
        return;
      }
      if (closeOnSuccess) setOpenDialog(null);
    });
  };

  const CONFIRM_COPY: Record<string, { title: string; description: string; confirmLabel: string }> = {
    ACTIVE: {
      title: `¿Reactivar "${organization.name}"?`,
      description: "Vuelve a poder crear servicios, recursos, clientes, horarios y equipo.",
      confirmLabel: "Sí, reactivar",
    },
    SUSPENDED: {
      title: `¿Suspender "${organization.name}"?`,
      description:
        "No va a poder crear servicios, recursos, clientes, horarios ni equipo nuevos. Su panel y su calendario público con las reservas existentes siguen funcionando.",
      confirmLabel: "Sí, suspender",
    },
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {plans.map((plan) => {
          const key = `plan-${plan.code}`;
          return (
            <Button
              key={plan.code}
              type="button"
              size="touch"
              variant={organization.planCode === plan.code ? "default" : "outline"}
              disabled={pending}
              onClick={() => run(plan.code, organization.subscriptionStatus, key)}
            >
              {pendingKey === key ? "…" : plan.name}
            </Button>
          );
        })}
        <span className="mx-1 h-4 w-px bg-border" />
        {STATUSES.map((status) => {
          const key = `status-${status.value}`;
          const disabled = organization.subscriptionStatus === status.value || pending;
          const copy = CONFIRM_COPY[status.value];

          if (!copy) {
            return (
              <Button
                key={status.value}
                type="button"
                size="touch"
                variant="ghost"
                disabled={disabled}
                onClick={() => run(organization.planCode ?? "starter", status.value, key)}
              >
                {pendingKey === key ? "…" : status.label}
              </Button>
            );
          }

          return (
            <ConfirmDialog
              key={status.value}
              open={openDialog === status.value}
              onOpenChange={(open) => {
                setOpenDialog(open ? status.value : null);
                setError(null);
              }}
              trigger={
                <Button type="button" size="touch" variant="ghost" disabled={disabled}>
                  {status.label}
                </Button>
              }
              title={copy.title}
              description={copy.description}
            >
              <FormError className="sm:order-first sm:mr-auto sm:w-auto sm:flex-1">
                {openDialog === status.value ? error : null}
              </FormError>
              <Button
                type="button"
                variant="destructive"
                size="touch"
                disabled={pending}
                className="w-full sm:w-auto"
                onClick={() =>
                  run(organization.planCode ?? "starter", status.value, key, status.value)
                }
              >
                {pendingKey === key ? "Guardando…" : copy.confirmLabel}
              </Button>
            </ConfirmDialog>
          );
        })}
      </div>
      <FormError>{openDialog ? null : error}</FormError>
    </div>
  );
}
