import * as React from "react";
import { cn } from "cn";

/**
 * The one badge.
 *
 * `tone` says what it means, `variant` says how loud it is. The tones are
 * the product's semantic colours (ADR-0020: they never change per
 * organization, only `primary` follows the brand accent), so a green badge
 * means the same thing in the panel, the portal and the public agenda.
 *
 *   <Badge tone="success">Pagado</Badge>            resting status
 *   <Badge tone="danger" variant="solid">Lleno</Badge>   needs to be seen first
 *   <Badge tone="neutral" variant="outline">Borrador</Badge>
 *
 * A badge is a label, not a button. If it has to be tapped it's a Button
 * with `size="sm"`, because a 20px-tall pill is not a touch target.
 */
export type BadgeTone = "neutral" | "primary" | "success" | "warning" | "danger";
export type BadgeVariant = "subtle" | "solid" | "outline";

const SUBTLE: Record<BadgeTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  primary: "bg-primary-subtle text-primary",
  success: "bg-success-subtle text-success",
  warning: "bg-warning-subtle text-warning-foreground",
  danger: "bg-destructive-subtle text-destructive",
};

const SOLID: Record<BadgeTone, string> = {
  neutral: "bg-foreground/85 text-background",
  primary: "bg-primary text-primary-foreground",
  success: "bg-success text-success-foreground",
  warning: "bg-warning text-warning-foreground",
  danger: "bg-destructive text-destructive-foreground",
};

const OUTLINE: Record<BadgeTone, string> = {
  neutral: "border border-border text-muted-foreground",
  primary: "border border-primary/40 text-primary",
  success: "border border-success/40 text-success",
  warning: "border border-warning/50 text-warning-foreground",
  danger: "border border-destructive/40 text-destructive",
};

const VARIANTS: Record<BadgeVariant, Record<BadgeTone, string>> = {
  subtle: SUBTLE,
  solid: SOLID,
  outline: OUTLINE,
};

export function Badge({
  tone = "neutral",
  variant = "subtle",
  shape = "pill",
  className,
  ...props
}: React.ComponentProps<"span"> & {
  tone?: BadgeTone;
  variant?: BadgeVariant;
  /** `pill` for statuses, `rounded` when it sits flush against a control. */
  shape?: "pill" | "rounded";
}) {
  return (
    <span
      data-slot="badge"
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        shape === "pill" ? "rounded-full" : "rounded-md",
        VARIANTS[variant][tone],
        className,
      )}
      {...props}
    />
  );
}

/**
 * A 6px dot for use inside a Badge, or on its own in a dense row where a
 * full badge would be noise. Purely decorative: the meaning has to be in
 * the text next to it, never in the colour alone.
 */
export function Dot({
  tone = "neutral",
  className,
}: {
  tone?: BadgeTone;
  className?: string;
}) {
  const fills: Record<BadgeTone, string> = {
    neutral: "bg-muted-foreground",
    primary: "bg-primary",
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-destructive",
  };

  return (
    <span
      aria-hidden
      className={cn("inline-block size-1.5 shrink-0 rounded-full", fills[tone], className)}
    />
  );
}
