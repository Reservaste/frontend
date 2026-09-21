"use client";

import { useMemo, useState } from "react";
import { cn } from "cn";
import type { AgendaOccurrence } from "@/app/actions/admin";
import { ScheduleCalendar, type CalendarEvent } from "./schedule-calendar";
import type { CalendarView } from "@/lib/calendar";

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

    return source.map((o) => {
      const free = o.capacity - o.confirmedCount;
      const cancelled = o.status === "CANCELLED";

      return {
        id: o.id,
        startAt: o.startAt,
        endAt: o.endAt,
        title: o.serviceName,
        color: colorOf.get(o.serviceId) ?? null,
        // Occupancy at a glance is what an agenda is for; the long form
        // only appears where there is room for it.
        meta: cancelled ? "Cancelado" : `${o.confirmedCount} / ${o.capacity}`,
        tone: cancelled ? "neutral" : free === 0 ? "danger" : free <= 2 ? "warning" : "primary",
        href: `/org/${organizationSlug}/agenda/${o.id}`,
        titleHref: `/org/${organizationSlug}/services/${o.serviceId}/schedule`,
        muted: cancelled,
      };
    });
  }, [occurrences, hidden, lockedServiceId, colorOf, organizationSlug]);

  const filter =
    lockedServiceId || services.length <= 1 ? null : (
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => persist(new Set())}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            hidden.size === 0 ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
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
                "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                on ? "bg-card" : "opacity-50 hover:opacity-80",
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
