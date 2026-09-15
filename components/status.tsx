import { cn } from "cn";

type Tone = "neutral" | "primary" | "success" | "warning" | "danger";

const TONES: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  primary: "bg-primary-subtle text-primary",
  success: "bg-success-subtle text-success",
  warning: "bg-warning-subtle text-warning-foreground",
  danger: "bg-destructive-subtle text-destructive",
};

export function StatusBadge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Occupancy at a glance for the admin agenda. The bar fills toward
 * capacity and shifts colour as it does -- the number alone made every
 * row look identical at a glance, which is the opposite of what an
 * agenda is for.
 */
export function OccupancyBar({
  confirmed,
  capacity,
  className,
}: {
  confirmed: number;
  capacity: number;
  className?: string;
}) {
  const ratio = capacity > 0 ? Math.min(confirmed / capacity, 1) : 0;
  const tone =
    ratio >= 1 ? "bg-destructive" : ratio >= 0.8 ? "bg-warning" : "bg-success";

  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div
        className={cn("h-full rounded-full transition-all", tone)}
        style={{ width: `${Math.max(ratio * 100, confirmed > 0 ? 6 : 0)}%` }}
      />
    </div>
  );
}

/** Availability wording for the public side, mapped to a tone. */
export function availabilityTone(status: string | null, remaining: number | null): Tone {
  if (status === "FULL" || remaining === 0) return "danger";
  if (status === "LOW") return "warning";
  return "success";
}
