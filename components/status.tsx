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
 * How full a slot is, as a tone -- the single threshold (80% of capacity)
 * every admin surface uses to turn `confirmed`/`capacity` into a colour:
 * this bar and the agenda's own calendar blocks (`AgendaCalendar`) both
 * call this instead of each picking their own cutoff.
 *
 * Not the same threshold as ADR-0008's `lowAvailabilityPercentage` --
 * that one governs what a *customer* is told (configurable per
 * organization, and the frontend never receives it for admin views,
 * which already show the real numbers). This is a fixed, presentation-only
 * cutoff for staff looking at a bar or a block, not a disclosure rule.
 */
export function occupancyTone(confirmed: number, capacity: number): "success" | "warning" | "danger" {
  const ratio = capacity > 0 ? Math.min(confirmed / capacity, 1) : 0;
  if (ratio >= 1) return "danger";
  if (ratio >= 0.8) return "warning";
  return "success";
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
  const tone = occupancyTone(confirmed, capacity);
  const barClass =
    tone === "danger" ? "bg-destructive" : tone === "warning" ? "bg-warning" : "bg-success";

  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div
        className={cn("h-full rounded-full transition-all", barClass)}
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
