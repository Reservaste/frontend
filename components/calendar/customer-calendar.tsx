"use client";

import { useMemo, useState } from "react";
import { cn } from "cn";
import type { NotGeneratedReason } from "@reservaste/domain";
import { ScheduleCalendar, type CalendarEvent } from "./schedule-calendar";
import type { PublicSlot } from "./public-calendar";
import { nowMs } from "@/lib/calendar";
import { occurrenceKey } from "@/lib/my-agenda";

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
 */
export function CustomerCalendar({
  organizationSlug,
  bookings,
  slots,
  timeZone,
  canBook,
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
}) {
  const [scope, setScope] = useState<Scope>("mine");
  const effectiveScope: Scope = canBook ? scope : "mine";

  const mine: CalendarEvent[] = useMemo(() => {
    const now = nowMs();

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
        href: `/me/reserva/${booking.bookingId}`,
        muted: cancelled,
        past,
      } satisfies CalendarEvent;
    });
  }, [bookings]);

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
        tone: slot.full ? "neutral" : "success",
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
      initialView="week"
      responsiveDefault="day"
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
