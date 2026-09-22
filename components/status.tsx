import { cn } from "cn";
import { Badge, type BadgeTone } from "@/components/ui/badge";

type Tone = BadgeTone;

/**
 * Domain-flavoured alias of `Badge`: a booking/payment/availability status.
 *
 * It exists because the call sites read better as "status badge", and
 * because `availabilityTone()` below returns exactly this tone set. The
 * styling is `Badge`'s — there is only one badge in the product.
 */
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
    <Badge tone={tone} className={className}>
      {children}
    </Badge>
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
