import { cn } from "cn";
import { StatusBadge } from "@/components/status";

/**
 * The three "didn't confirm yet" counters that `StandingReservation` and
 * `CustomerStandingReservation` (`@/app/actions/standing`) both carry. A
 * plain shape, not either exported type, so this doesn't create an import
 * cycle and stays usable from any screen that has *a* standing reservation
 * with these three numbers -- the schedule page's list and the customer
 * ficha's list, so far.
 */
export interface StandingPendingCounts {
  upcomingUnpaid: number;
  upcomingOverQuota: number;
  upcomingBeyondPeriod: number;
}

/**
 * The explanatory sentences for whichever of the three counters are > 0,
 * urgent first: unpaid (blocks confirming, fixable today) → over quota
 * (blocks confirming, needs a plan change) → beyond period (not a problem,
 * just the billing horizon). Extracted from `standing-reservations.tsx` so
 * the customer ficha's "Horarios fijos" section tells the exact same story
 * instead of drifting into a second wording for the same three concepts.
 */
export function StandingPendingNotes({
  counts,
  className,
}: {
  counts: StandingPendingCounts;
  className?: string;
}) {
  if (counts.upcomingUnpaid === 0 && counts.upcomingOverQuota === 0 && counts.upcomingBeyondPeriod === 0) {
    return null;
  }

  return (
    // `gap-0.5`: the original inline JSX these three lines sit next to
    // (name, confirmed count) is itself a `flex flex-col gap-0.5` -- match
    // it so a series that's both unpaid AND over quota at once still reads
    // as two separate lines, not two glued together.
    <div className={cn("flex flex-col gap-0.5", className)}>
      {counts.upcomingUnpaid > 0 ? (
        <span className="block text-xs text-destructive">
          <span className="tnum">{counts.upcomingUnpaid}</span>{" "}
          {counts.upcomingUnpaid === 1 ? "fecha está esperando" : "fechas están esperando"} que se
          ponga al día el pago del período actual para confirmarse.
        </span>
      ) : null}
      {counts.upcomingOverQuota > 0 ? (
        <span className="block text-xs text-warning-foreground">
          <span className="tnum">{counts.upcomingOverQuota}</span> de esas fechas exceden la
          frecuencia que compró. Cobrarle el mes no las destraba: hace falta un plan con más
          frecuencia, o quitarle otro horario fijo.
        </span>
      ) : null}
      {counts.upcomingBeyondPeriod > 0 ? (
        <span className="block text-xs text-muted-foreground">
          <span className="tnum">{counts.upcomingBeyondPeriod}</span> caen más adelante que el
          período que ya pagó. No hay nada para cobrar todavía: se confirman solas cuando pague ese
          período.
        </span>
      ) : null}
    </div>
  );
}

/** Same three counters, as the badge row that sits next to the row's actions. */
export function StandingPendingBadges({ counts }: { counts: StandingPendingCounts }) {
  if (counts.upcomingUnpaid === 0 && counts.upcomingOverQuota === 0 && counts.upcomingBeyondPeriod === 0) {
    return null;
  }

  return (
    <>
      {counts.upcomingUnpaid > 0 ? <StatusBadge tone="danger">Falta el pago</StatusBadge> : null}
      {counts.upcomingOverQuota > 0 ? (
        <StatusBadge tone="warning">
          <span className="tnum">{counts.upcomingOverQuota}</span> fuera del plan
        </StatusBadge>
      ) : null}
      {counts.upcomingBeyondPeriod > 0 ? (
        <StatusBadge tone="neutral">
          <span className="tnum">{counts.upcomingBeyondPeriod}</span> fuera del período
        </StatusBadge>
      ) : null}
    </>
  );
}
