"use client";

import { useOptimistic, useTransition } from "react";
import { cn } from "cn";
import type { OccurrenceAttendee } from "@/app/actions/admin";
import { markAttendance } from "@/app/actions/admin";

type Status = "PENDING" | "PRESENT" | "ABSENT";

/**
 * Taking the roll, designed for a phone held in one hand at the door of a
 * class (ADR-0023). Two targets per person, each a full half-row, so it
 * can be used with a thumb without aiming.
 *
 * Optimistic because the person doing this is going down a list at
 * speed: waiting for a round trip between names would make it feel
 * broken even when it works.
 */
export function RollCall({
  organizationSlug,
  occurrenceId,
  attendees,
}: {
  organizationSlug: string;
  occurrenceId: string;
  attendees: OccurrenceAttendee[];
}) {
  const [, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(
    attendees,
    (current: OccurrenceAttendee[], change: { bookingId: string; status: Status }) =>
      current.map((a) =>
        a.bookingId === change.bookingId ? { ...a, attendanceStatus: change.status } : a,
      ),
  );

  const mark = (bookingId: string, status: Status) => {
    startTransition(async () => {
      setOptimistic({ bookingId, status });
      await markAttendance(organizationSlug, occurrenceId, bookingId, status);
    });
  };

  const present = optimistic.filter((a) => a.attendanceStatus === "PRESENT").length;
  const absent = optimistic.filter((a) => a.attendanceStatus === "ABSENT").length;
  const pending = optimistic.length - present - absent;

  return (
    <div className="flex flex-col gap-3">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 rounded-xl border bg-card/95 px-4 py-3 shadow-card backdrop-blur">
        <span className="text-sm font-medium">
          <span className="tnum">{optimistic.length}</span> reservados
        </span>
        <div className="flex gap-3 text-sm">
          <span className="tnum text-success">{present} presentes</span>
          <span className="tnum text-destructive">{absent} ausentes</span>
          {pending > 0 ? <span className="tnum text-muted-foreground">{pending} sin marcar</span> : null}
        </div>
      </div>

      <ul className="flex flex-col gap-2">
        {optimistic.map((attendee) => (
          <li
            key={attendee.bookingId}
            className="flex flex-col gap-2.5 rounded-xl border bg-card p-3.5 shadow-card"
          >
            <span className="text-base font-medium">{attendee.customerName}</span>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                aria-pressed={attendee.attendanceStatus === "PRESENT"}
                onClick={() =>
                  mark(
                    attendee.bookingId,
                    attendee.attendanceStatus === "PRESENT" ? "PENDING" : "PRESENT",
                  )
                }
                className={cn(
                  // 56px tall: a comfortable thumb target, not a desktop
                  // button that happens to also work on a phone.
                  "flex h-14 items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition-colors",
                  attendee.attendanceStatus === "PRESENT"
                    ? "border-success bg-success text-success-foreground"
                    : "bg-card hover:bg-success-subtle",
                )}
              >
                <svg viewBox="0 0 24 24" fill="none" className="size-5">
                  <path
                    d="M20 6L9 17l-5-5"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Presente
              </button>

              <button
                type="button"
                aria-pressed={attendee.attendanceStatus === "ABSENT"}
                onClick={() =>
                  mark(
                    attendee.bookingId,
                    attendee.attendanceStatus === "ABSENT" ? "PENDING" : "ABSENT",
                  )
                }
                className={cn(
                  "flex h-14 items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition-colors",
                  attendee.attendanceStatus === "ABSENT"
                    ? "border-destructive bg-destructive text-destructive-foreground"
                    : "bg-card hover:bg-destructive-subtle",
                )}
              >
                <svg viewBox="0 0 24 24" fill="none" className="size-5">
                  <path
                    d="M18 6L6 18M6 6l12 12"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>
                Ausente
              </button>
            </div>
          </li>
        ))}
      </ul>

      <p className="text-center text-xs text-muted-foreground">
        Tocá de nuevo el botón marcado para volver a dejarlo sin marcar.
      </p>
    </div>
  );
}
