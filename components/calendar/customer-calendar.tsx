"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import type { NotGeneratedReason } from "@reservaste/domain";
import { ScheduleCalendar, useIsNarrow, type CalendarEvent } from "./schedule-calendar";
import type { PublicSlot } from "./public-calendar";
import { nowMs, todayKey, type CalendarView } from "@/lib/calendar";
import { occurrenceKey } from "@/lib/my-agenda";

/**
 * Query params this calendar mirrors its view/anchor into, same
 * vocabulary as `AgendaCalendar` (`?vista=`/`?fecha=`, parsed by
 * `parseCalendarView`/`parseAnchorKey` in `lib/calendar.ts`). `/me/page.tsx`
 * reads them server-side and passes the result down as
 * `initialView`/`initialAnchor`.
 */
const VIEW_PARAM = "vista";
const ANCHOR_PARAM = "fecha";

/** One of the customer's own bookings, as `my_bookings()` returns it. */
export interface CustomerAgendaBooking {
  bookingId: string;
  startAt: string;
  endAt: string;
  serviceName: string;
  status: "CONFIRMED" | "CANCELLED" | "NOT_GENERATED";
  cancellationReason: string | null;
  isRecurring: boolean;
  notGeneratedReason: NotGeneratedReason | null;
}

type Scope = "mine" | "all";

/**
 * Short enough to sit inside a calendar block. The long, actionable
 * wording for each of these lives in `BOOKING_REASONS` and is shown on the
 * booking's own screen -- a 64px-tall block is not where someone reads a
 * paragraph about plan quotas.
 */
const NOT_GENERATED_SHORT: Record<string, string> = {
  PAYMENT_REQUIRED: "Falta el pago",
  DUPLICATE: "Ya estás anotado",
  OVER_PLAN_QUOTA: "Fuera de tu plan",
  OUTSIDE_PLAN_QUOTA: "Fuera de tu plan",
  SLOT_FULL: "Sin lugar",
};

/**
 * The customer portal's agenda: the same grid as the admin agenda and the
 * public calendar (ADR-0023), with the two things only the person
 * themselves gets -- their own classes highlighted, and the ability to
 * flip to everything the business offers without leaving the portal.
 *
 * One organization at a time, always. A week grid is laid out in one
 * timezone (ADR-0014) and someone can be a customer of businesses in
 * several; mixing them would put a 09:00 class in the wrong column with no
 * way to tell. Which organization is chosen on the server, by `?org=`.
 *
 * The toggle is presentation only: both datasets are already here, so it
 * never fires a request and "mis clases" can never hide a class by
 * failing to load one.
 *
 * View and anchor live here (not inside `ScheduleCalendar`), same reason
 * and same recipe as `AgendaCalendar`: mirrored into `?vista=`/`?fecha=`
 * via `history.replaceState` (never `router.replace` -- this route is
 * dynamic, so a router navigation would refetch bookings/availability from
 * the server on every arrow press) so a real navigation away and back --
 * opening one of the person's own bookings and tapping "Mi agenda" -- lands
 * on the same day/week they were looking at, not "this week" again.
 */
export function CustomerCalendar({
  organizationSlug,
  bookings,
  slots,
  timeZone,
  canBook,
  initialView,
  initialAnchor,
}: {
  organizationSlug: string;
  bookings: CustomerAgendaBooking[];
  slots: PublicSlot[];
  timeZone: string;
  /**
   * False when the business's public page has nothing to offer (no active
   * service, organization suspended): "Toda la agenda" would be an empty
   * grid pretending to be a choice, so it isn't offered.
   */
  canBook: boolean;
  /** The day/week to open on, straight from `?vista=` (already narrowed to "day"/"week" by the caller). */
  initialView?: CalendarView;
  /** The day/week to open on, straight from `?fecha=`. Defaults to today. */
  initialAnchor?: string;
}) {
  const pathname = usePathname();
  // Same fallback this calendar always had (`responsiveDefault="day"`,
  // `initialView="week"`) for the case nobody picked a view yet -- going
  // controlled below (to mirror the URL) means `ScheduleCalendar`'s own
  // `uncontrolledView` computation, which used to supply this, never runs.
  const isNarrow = useIsNarrow();
  const [picked, setPicked] = useState<{ view: CalendarView; anchor: string } | null>(null);
  const view: CalendarView = picked?.view ?? initialView ?? (isNarrow ? "day" : "week");
  const anchor: string = picked?.anchor ?? initialAnchor ?? todayKey(timeZone);

  const handleChange = (next: { view: CalendarView; anchor: string }) => {
    setPicked(next);
    const params = new URLSearchParams();
    // `org` is how `/me` knows which business's agenda this is (ADR-0006:
    // a customer can belong to several) -- lost, the URL would silently
    // fall back to whichever organization `pickCustomerOrganization` picks
    // by default on the next real navigation.
    params.set("org", organizationSlug);
    params.set(VIEW_PARAM, next.view);
    params.set(ANCHOR_PARAM, next.anchor);
    window.history.replaceState(null, "", `${pathname}?${params.toString()}`);
  };

  const [scope, setScope] = useState<Scope>("mine");
  const effectiveScope: Scope = canBook ? scope : "mine";

  const mine: CalendarEvent[] = useMemo(() => {
    const now = nowMs();
    // The state to hand back to `/me/reserva/[bookingId]` so its own
    // "Mi agenda" link can restore it (Causa 2): a `<Link>` to a named
    // destination, not browser history, so the state has to travel with
    // it explicitly or it resets on the way back.
    const stateQuery = `vista=${view}&fecha=${anchor}`;

    return bookings.map((booking) => {
      const past = new Date(booking.endAt).getTime() <= now;
      const cancelled = booking.status === "CANCELLED";
      const pending = booking.status === "NOT_GENERATED";

      const meta = cancelled
        ? booking.cancellationReason === "CUSTOMER_REQUEST"
          ? "Liberaste el cupo"
          : "Cancelada"
        : pending
          ? (NOT_GENERATED_SHORT[booking.notGeneratedReason ?? ""] ?? "Sin confirmar")
          : past
            ? "Asististe"
            : booking.isRecurring
              ? "Tu reserva fija"
              : "Tu reserva";

      return {
        id: `booking:${booking.bookingId}`,
        startAt: booking.startAt,
        endAt: booking.endAt,
        title: booking.serviceName,
        color: null,
        meta,
        // Confirmed classes are the loud ones: this calendar exists to
        // answer "when do I have to be there".
        tone: cancelled
          ? "neutral"
          : pending
            ? booking.notGeneratedReason === "PAYMENT_REQUIRED"
              ? "danger"
              : "warning"
            : "primary",
        href: `/me/reserva/${booking.bookingId}?${stateQuery}`,
        muted: cancelled,
        past,
      } satisfies CalendarEvent;
    });
  }, [bookings, view, anchor]);

  const events: CalendarEvent[] = useMemo(() => {
    if (effectiveScope === "mine") return mine;

    // A class the person is already in must not appear twice: their own
    // block wins, because it is the one that says "you are going" and the
    // one that leads somewhere they can act.
    const taken = new Set(
      bookings
        .filter((booking) => booking.status === "CONFIRMED")
        .map((booking) => occurrenceKey(booking.startAt, booking.serviceName)),
    );

    const open: CalendarEvent[] = slots
      .filter((slot) => !taken.has(occurrenceKey(slot.startAt, slot.serviceName)))
      .map((slot) => ({
        id: `slot:${slot.slotOccurrenceId}`,
        startAt: slot.startAt,
        endAt: slot.endAt,
        title: slot.serviceName,
        color: slot.serviceColor,
        // ADR-0008: whatever the database chose to disclose, verbatim.
        meta: slot.recentlyReleased ? `${slot.availability} · Cupo liberado` : slot.availability,
        // Same neutral-not-danger choice as the public calendar for a full
        // slot (nobody's fault), plus a warning tone for the last few
        // seats (`availabilityTone`, components/status.tsx).
        tone: slot.full ? "neutral" : slot.low ? "warning" : "success",
        // A full slot is not a dead link, it is simply not a link.
        href: slot.full
          ? null
          : `/${organizationSlug}/reservar/confirmar?slot=${slot.slotOccurrenceId}`,
        muted: slot.full,
      }));

    return [...open, ...mine];
  }, [effectiveScope, mine, slots, bookings, organizationSlug]);

  const toolbarExtra = (
    <div className="flex flex-col gap-2">
      {canBook ? (
        <div className="flex items-center gap-1.5">
          <ScopeChip active={effectiveScope === "mine"} onClick={() => setScope("mine")}>
            Mis clases
          </ScopeChip>
          <ScopeChip active={effectiveScope === "all"} onClick={() => setScope("all")}>
            Toda la agenda
          </ScopeChip>
        </div>
      ) : null}

      {effectiveScope === "all" ? (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-primary" />
            Tus clases
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-success" />
            Con lugar
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-warning" />
            Últimos lugares
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-muted-foreground/40" />
            Completo
          </span>
        </p>
      ) : null}
    </div>
  );

  return (
    <ScheduleCalendar
      events={events}
      timeZone={timeZone}
      // No month view here for the same reason the public calendar skips
      // it: someone checking their week is not surveying a quarter.
      views={["day", "week"]}
      view={view}
      anchor={anchor}
      onChange={handleChange}
      toolbarExtra={toolbarExtra}
      emptyLabel={
        effectiveScope === "mine"
          ? "No tenés clases en este período."
          : "No hay horarios en este período."
      }
    />
  );
}

function ScopeChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        // Touch density: 44px tall on a phone, admin density from `sm` up
        // -- the same two heights `size="touch"` uses on every other
        // customer-facing control.
        "inline-flex min-h-11 items-center rounded-full px-4 text-sm font-medium transition-all sm:min-h-9",
        active
          ? "bg-primary text-primary-foreground shadow-card"
          : "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
