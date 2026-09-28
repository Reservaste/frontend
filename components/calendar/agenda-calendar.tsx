"use client";

import { useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "cn";
import type { AgendaOccurrence } from "@/app/actions/admin";
import { ScheduleCalendar, type CalendarEvent } from "./schedule-calendar";
import { nowMs, parseAnchorKey, parseCalendarView, todayKey, type CalendarView } from "@/lib/calendar";
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
 * Query params this calendar mirrors its view/anchor into: `?vista=` and
 * `?fecha=` (parsed by `parseCalendarView`/`parseAnchorKey` in
 * `lib/calendar.ts`). Both agenda pages read them server-side and pass the
 * result down as `initialView`/`initialAnchor`.
 */
const VIEW_PARAM = "vista";
const ANCHOR_PARAM = "fecha";

/**
 * The admin calendar: the shared grid plus the two things only staff get
 * -- a per-service filter and a link from the block's title straight to
 * the service (ADR-0023).
 *
 * The filter is presentation only. It never changes a query, so a hidden
 * service cannot be mistaken for a cancelled one.
 *
 * View and anchor live here (not inside `ScheduleCalendar`) so they can be
 * mirrored into the URL: a click on a slot or a service navigates away,
 * and the browser's back button should restore exactly the week/day the
 * admin was looking at, not remount to "this week, default view".
 */
export function AgendaCalendar({
  organizationSlug,
  occurrences,
  services,
  timeZone,
  lockedServiceId,
  initialView = "week",
  initialAnchor,
}: {
  organizationSlug: string;
  occurrences: AgendaOccurrence[];
  services: CalendarService[];
  timeZone: string;
  /** Set on a service's own Agenda tab: no filter, nothing to choose. */
  lockedServiceId?: string;
  initialView?: CalendarView;
  /** The day/week/month to open on, straight from `?fecha=`. Defaults to today. */
  initialAnchor?: string;
}) {
  const pathname = usePathname();

  // `useSearchParams()`, not the server-supplied `initialView`/`initialAnchor`
  // props, is the reactive source of truth for view/anchor. It used to be
  // the other way around, seeded once into a `useState` and reconciled
  // against the props on every render (the "adjust state during render"
  // pattern, `customer-forms.tsx`) on the theory that `initialView`/
  // `initialAnchor` change whenever a real navigation re-reads `?vista=`/
  // `?fecha=` server-side. That theory doesn't hold for the browser's
  // native back button: confirmed empirically (see the "atrás" bug writeup
  // this fix closes) that a `popstate` back to this route *does* cause a
  // fresh mount of this component -- so the reconciliation guard, which
  // only ever fires on an *existing* instance receiving new props, never
  // gets a chance to run -- but that fresh mount is built from Next's
  // client-side Router Cache, seeded with whatever `initialView`/
  // `initialAnchor` this route last actually rendered *on the server*
  // (page load or a real Link navigation), not the URL the popstate landed
  // on. `history.replaceState` below never asks the server to re-render,
  // by design (see the comment inside `handleChange`), so on the very
  // first "Siguiente" press that cached payload is already stale, and it
  // never refreshes until an actual reload.
  //
  // `useSearchParams()` sidesteps the cache entirely. Next patches
  // `window.history.pushState`/`replaceState` and its own `popstate`
  // listener (`app-router.js`) to dispatch an internal `ACTION_RESTORE`
  // that updates `usePathname()`/`useSearchParams()` from the *current*
  // URL on every navigation -- a real Link, this component's own
  // `replaceState` call, and the browser's native back/forward -- entirely
  // independent of whether the segment itself was cached and reused. It is
  // the one thing in this component guaranteed to reflect `?vista=`/
  // `?fecha=` after a `popstate`, because Next keeps it in sync as part of
  // making its own `usePathname`/`useSearchParams` hooks work, not as part
  // of re-rendering this route's Server Component.
  const searchParams = useSearchParams();
  const view: CalendarView =
    parseCalendarView(searchParams.get(VIEW_PARAM) ?? undefined) ?? initialView;
  const anchor: string =
    parseAnchorKey(searchParams.get(ANCHOR_PARAM) ?? undefined) ??
    initialAnchor ??
    todayKey(timeZone);

  const handleChange = (next: { view: CalendarView; anchor: string }) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(VIEW_PARAM, next.view);
    params.set(ANCHOR_PARAM, next.anchor);
    // `history.replaceState`, not Next's `router.replace`: this route is
    // dynamic (auth cookies), so a router navigation -- even one that only
    // changes the query string -- refetches the agenda from the server.
    // That is exactly the round trip the 90-day rolling window above
    // exists to avoid (every arrow press would wait on the network again).
    // Writing the URL directly is Next's own documented way to keep it in
    // sync without triggering that navigation -- and, per the comment
    // above, it's also what keeps `useSearchParams()` (read above) current,
    // which is the only reason this still works after the browser's back
    // button. No local `setState` needed here anymore: `useSearchParams()`
    // updating is what causes this component to re-render with `next`.
    window.history.replaceState(null, "", `${pathname}?${params.toString()}`);
  };

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
        titleHref: `/org/${organizationSlug}/services/${o.serviceId}/agenda`,
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
      view={view}
      anchor={anchor}
      onChange={handleChange}
      toolbarExtra={filter}
      emptyLabel={
        hidden.size > 0
          ? "No hay turnos de los servicios seleccionados en este período."
          : "No hay turnos en este período."
      }
    />
  );
}
