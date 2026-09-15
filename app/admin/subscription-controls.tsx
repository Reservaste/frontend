"use client";

import { setSubscription, type PlatformOrganization } from "@/app/actions/platform";
import { Button } from "@/components/ui/button";

const STATUSES = [
  { value: "ACTIVE", label: "Activar" },
  { value: "PAST_DUE", label: "Marcar impago" },
  { value: "SUSPENDED", label: "Suspender" },
];

export function SubscriptionControls({
  organization,
  plans,
}: {
  organization: PlatformOrganization;
  plans: { code: string; name: string }[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {plans.map((plan) => (
        <Button
          key={plan.code}
          size="xs"
          variant={organization.planCode === plan.code ? "default" : "outline"}
          onClick={() =>
            setSubscription(organization.organizationId, plan.code, organization.subscriptionStatus)
          }
        >
          {plan.name}
        </Button>
      ))}
      <span className="mx-1 h-4 w-px bg-border" />
      {STATUSES.map((status) => (
        <Button
          key={status.value}
          size="xs"
          variant="ghost"
          disabled={organization.subscriptionStatus === status.value}
          onClick={() =>
            setSubscription(
              organization.organizationId,
              organization.planCode ?? "starter",
              status.value,
            )
          }
        >
          {status.label}
        </Button>
      ))}
    </div>
  );
}
