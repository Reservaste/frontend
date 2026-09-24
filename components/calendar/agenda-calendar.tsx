"use client";

import { useMemo, useState } from "react";
import { cn } from "cn";
import type { AgendaOccurrence } from "@/app/actions/admin";
import { ScheduleCalendar, type CalendarEvent } from "./schedule-calendar";
import { nowMs, type CalendarView } from "@/lib/calendar";
import { occupancyTone } from "@/components/status";

/**
 * `occupancyTone`'s vocabulary mapped onto the calendar's own tone set.
 * "Available" stays `primary` here rather than becoming `success` --
 * that's the tone this calendar already used for every open slot, and
 * `success` is reserved for the public/customer-facing calendars where a
 * green block means "you can book this".
 */
const OCCUPANCY_CALENDAR_TONE: Record<ReturnType<typeof occupancyTone>, CalendarEvent["tone"]> = {
  success: "primary",
  warning: "warning",
  danger: "danger",
};

export interface CalendarService {
  id: string;
  name: string;
  color: string | null;
}

const FILTER_STORAGE_PREFIX = "reservaste:agenda-services:";

/**
 * The admin calendar: the shared grid plus the two things only staff get
 * -- a per-service filter and a link from the block's title straight to
 * the service (ADR-0023).
 *
 * The filter is presentation only. It never changes a query, so a hidden
 * service cannot be mistaken for a cancelled one.
 */
export function AgendaCalendar({
  organizationSlug,
  occurrences,
  services,
  timeZone,
  lockedServiceId,
  initialView = "week",
}: {
  organizationSlug: string;
  occurrences: AgendaOccurrence[];
  services: CalendarService[];
  timeZone: string;
  /** Set on a service's own Agenda tab: no filter, nothing to choose. */
  lockedServiceId?: string;
  initialView?: CalendarView;
}) {
  const [hidden, setHidden] = useState<Set<string>>(() => {
    if (lockedServiceId || typeof window === "undefined") return new Set();
    try {
      const raw = window.sessionStorage.getItem(FILTER_STORAGE_PREFIX + organizationSlug);
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    } catch {
      // Private windows and blocked storage both land here; a filter that
      // forgets itself is better than a screen that fails to render.
      return new Set();
    }
  });

  const persist = (next: Set<string>) => {
    setHidden(next);
    try {
      window.sessionStorage.setItem(
        FILTER_STORAGE_PREFIX + organizationSlug,
        JSON.stringify([...next]),
      );
    } catch {
      /* not worth telling anyone about */
    }
  };

  const colorOf = useMemo(
    () => new Map(services.map((s) => [s.id, s.color] as const)),
    [services],
  );

  const events: CalendarEvent[] = useMemo(() => {
    const source = lockedServiceId
      ? occurrences.filter((o) => o.serviceId === lockedServiceId)
      : occurrences.filter((o) => !hidden.has(o.serviceId));

    // Computed once per render, not a ticking clock: an agenda that's been
    // open on screen for an hour recomputing "past" every minute isn't
    // worth the complexity this screen needs. A slot in progress right now
    // (started, not yet ended) does not count as past -- it's still the
    // thing staff would act on.
    const now = nowMs();

    return source.map((o) => {
      const cancelled = o.status === "CANCELLED";
      const past = new Date(o.endAt).getTime() <= now;

      return {
        id: o.id,
        startAt: o.startAt,
        endAt: o.endAt,
        title: o.serviceName,
        color: colorOf.get(o.serviceId) ?? null,
        // Occupancy at a glance is what an agenda is for; the long form
        // only appears where there is room for it.
        meta: cancelled ? "Cancelado" : `${o.confirmedCount} / ${o.capacity}`,
        // Same 80%-of-capacity cutoff as the occurrence detail page's
        // OccupancyBar (`components/status.tsx`), not a new threshold.
        // A fixed "2 seats left" used to mean something very different for
        // a 3-seat class (already nearly full) than a 30-seat one (barely
        // touched) -- a share of capacity reads the same at any size.
        tone: cancelled ? "neutral" : OCCUPANCY_CALENDAR_TONE[occupancyTone(o.confirmedCount, o.capacity)],
        href: `/org/${organizationSlug}/agenda/${o.id}`,
        titleHref: `/org/${organizationSlug}/services/${o.serviceId}/schedule`,
        muted: cancelled,
        past,
      };
    });
  }, [occurrences, hidden, lockedServiceId, colorOf, organizationSlug]);

  const filter =
    lockedServiceId || services.length <= 1 ? null : (
      // Same filled-chip treatment as the public calendar's filter, at
      // admin density: a solid pill at rest instead of a hairline border,
      // so "on" vs "off" reads as a state change, not a colour nuance.
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => persist(new Set())}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-medium transition-all",
            hidden.size === 0
              ? "bg-primary text-primary-foreground shadow-card"
              : "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground",
          )}
        >
          Todos
        </button>
        {services.map((service) => {
          const on = !hidden.has(service.id);
          return (
            <button
              key={service.id}
              type="button"
              aria-pressed={on}
              onClick={() => {
                const next = new Set(hidden);
                if (on) next.add(service.id);
                else next.delete(service.id);
                persist(next);
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all",
                on
                  ? "bg-card text-foreground shadow-card ring-1 ring-border/70"
                  : "bg-muted/60 text-muted-foreground opacity-70 hover:opacity-100",
              )}
            >
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: service.color ?? "var(--primary)" }}
              />
              {service.name}
            </button>
          );
        })}
      </div>
    );

  return (
    <ScheduleCalendar
      events={events}
      timeZone={timeZone}
      initialView={initialView}
      toolbarExtra={filter}
      emptyLabel={
        hidden.size > 0
          ? "No hay turnos de los servicios seleccionados en este período."
          : "No hay turnos en este período."
      }
    />
  );
}
