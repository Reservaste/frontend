import * as React from "react";
import { cn } from "cn";

/**
 * A message block that belongs to the page, not to a field.
 *
 * Use it for the thing a whole screen has to say: "esta clase está
 * cancelada", "alcanzaste el límite de tu plan", "el pago quedó
 * registrado". For the message that belongs to one form or one input, use
 * `FormError` / `FormSuccess` from `ui/form` -- they're a single line and
 * sit directly under the control they're about.
 *
 *   <Alert tone="warning" title="Sin horarios publicados">
 *     Publicá un horario para que la agenda pública muestre algo.
 *   </Alert>
 *
 * `danger` gets `role="alert"` so it interrupts a screen reader; the other
 * tones get `role="status"`, which waits its turn. Nothing here is
 * dismissible on purpose: a message that can be dismissed is a toast.
 */
export type AlertTone = "info" | "success" | "warning" | "danger";

const TONES: Record<AlertTone, string> = {
  info: "bg-primary-subtle text-primary",
  success: "bg-success-subtle text-success",
  warning: "bg-warning-subtle text-warning-foreground",
  danger: "bg-destructive-subtle text-destructive",
};

export function Alert({
  tone = "info",
  title,
  icon,
  size = "default",
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"div">, "title"> & {
  tone?: AlertTone;
  title?: React.ReactNode;
  icon?: React.ReactNode;
  /** `sm` is the one-liner inside a card; `default` is the page-level block. */
  size?: "default" | "sm";
}) {
  return (
    <div
      data-slot="alert"
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        // The ring is the tone colour itself at low opacity rather than a
        // flat grey border, so the edge reads as part of the same colour
        // as the fill instead of a generic box drawn around it.
        "flex items-start gap-2 text-sm ring-1 ring-current/15",
        size === "sm" ? "rounded-lg px-3 py-2" : "rounded-xl px-4 py-3",
        TONES[tone],
        className,
      )}
      {...props}
    >
      {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : null}
      <div className="flex min-w-0 flex-col gap-0.5">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div>{children}</div> : null}
      </div>
    </div>
  );
}
