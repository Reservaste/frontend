"use client";

import { useState, useTransition } from "react";
import { markContactRequestHandled } from "@/app/actions/platform";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form";

/**
 * Marking a lead as followed up is low-stakes and has no destructive side
 * effect (unlike suspending an organization in `SubscriptionControls`), so
 * it stays a direct button instead of going through `ConfirmDialog` -- same
 * distinction that component's own comment draws.
 */
export function MarkHandledButton({ contactRequestId }: { contactRequestId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="touch"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await markContactRequestHandled(contactRequestId);
            if (result?.error) setError(result.error);
          });
        }}
      >
        {pending ? "Guardando…" : "Marcar atendido"}
      </Button>
      <FormError className="text-right">{error}</FormError>
    </div>
  );
}
