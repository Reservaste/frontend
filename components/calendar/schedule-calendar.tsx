"use client";

import Link from "next/link";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { cn } from "cn";
import { ChevronLeft, ChevronRight } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  CALENDAR_VIEWS,
  WEEKDAY_SHORT,
  formatRangeLabel,
  hourBounds,
  isSameMonth,
  isToday,
  localDayKey,
  minutesIntoDay,
  rangeFor,
  shiftAnchor,
  todayKey,
  type CalendarView,
} from "@/lib/calendar";

/**
 * One event on the grid. Deliberately plain data rather than a render
 * callback: the pages that use this are Server Components, so anything
 * crossing the boundary has to be serializable. Admin and public differ
 * in what they put in `meta`, `tone` and the links, not in how a week is
 * laid out.
 */
export interface CalendarEvent {
  id: string;
  startAt: string;
  endAt: string;
  title: string;
  /** Service colour, or null for the product accent. */
  color: string | null;
  /** "8 / 15" for staff, "4 lugares" for a visitor. */
  meta: string;
  tone: "neutral" | "primary" | "success" | "warning" | "danger";
  /** Where the block itself goes. */
  href: string | null;
  /** Where the title goes, when it differs from the block (ADR-0023). */
  titleHref?: string | null;
  muted?: boolean;
}

const TONE_BG: Record<CalendarEvent["tone"], string> = {
  neutral: "bg-muted text-foreground border-border",
  primary: "bg-primary-subtle text-foreground border-primary/30",
  success: "bg-success-subtle text-foreground border-success/30",
  warning: "bg-warning-subtle text-foreground border-warning/40",
  danger: "bg-destructive-subtle text-foreground border-destructive/30",
};

const HOUR_HEIGHT = 56;

/**
 * Whether the viewport is phone-sized.
 *
 * useSyncExternalStore rather than an effect: the media query is external
 * state that can change under us (rotating a phone), and reading it this
 * way keeps the rendered view and the declared view the same thing. The
 * server snapshot says "wide" because a server has no viewport; the
 * client corrects it on hydration.
 */
function useIsNarrow(): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    const query = window.matchMedia("(max-width: 640px)");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia("(max-width: 640px)").matches,
    () => false,
  );
}

export function ScheduleCalendar({
  events,
  timeZone,
  views = ["day", "week", "workweek", "month"],
  initialView = "week",
  emptyLabel = "No hay turnos en este período.",
  toolbarExtra,
  responsiveDefault,
  openOnFirstEvent = false,
}: {
  events: CalendarEvent[];
  timeZone: string;
  views?: CalendarView[];
  initialView?: CalendarView;
  emptyLabel?: string;
  toolbarExtra?: React.ReactNode;
  /** View to fall back to on a narrow screen, where a week of columns is cramped. */
  responsiveDefault?: CalendarView;
  /** Anchor on the first day that has something instead of on today. */
  openOnFirstEvent?: boolean;
}) {
  // Null until someone picks one: an unpicked view follows the viewport,
  // a picked one stays picked.
  const [pickedView, setPickedView] = useState<CalendarView | null>(null);
  const isNarrow = useIsNarrow();
  const view: CalendarView =
    pickedView ?? (responsiveDefault && isNarrow ? responsiveDefault : initialView);

  const [anchor, setAnchor] = useState(() => {
    const today = todayKey(timeZone);
    if (!openOnFirstEvent) return today;
    // A business closed on Mondays would otherwise greet every Monday
    // visitor with an empty grid.
    const upcoming = events
      .map((event) => localDayKey(new Date(event.startAt), timeZone))
      .filter((day) => day >= today)
      .sort();
    return upcoming[0] ?? today;
  });

  const range = useMemo(() => rangeFor(view, anchor), [view, anchor]);

  // Bucketed by the local day they fall on, which is the organization's
  // day, not the viewer's (ADR-0014).
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const key = localDayKey(new Date(event.startAt), timeZone);
      const list = map.get(key);
      if (list) list.push(event);
      else map.set(key, [event]);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.startAt.localeCompare(b.startAt));
    }
    return map;
  }, [events, timeZone]);

  const visible = range.days.flatMap((day) => byDay.get(day) ?? []);

  const { startHour, endHour } = useMemo(
    () => hourBounds(visible.map((e) => minutesIntoDay(new Date(e.startAt), timeZone))),
    [visible, timeZone],
  );

  const isCurrent = anchor === todayKey(timeZone);

  return (
    <div className="flex flex-col gap-3">
      {/* ---------------- Toolbar ---------------- */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Anterior"
            onClick={() => setAnchor(shiftAnchor(view, anchor, -1))}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant={isCurrent ? "secondary" : "outline"}
            size="sm"
            onClick={() => setAnchor(todayKey(timeZone))}
          >
            Hoy
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Siguiente"
            onClick={() => setAnchor(shiftAnchor(view, anchor, 1))}
          >
            <ChevronRight />
          </Button>
          <span className="ml-1.5 text-sm font-medium capitalize">
            {formatRangeLabel(view, range)}
          </span>
        </div>

        {views.length > 1 ? (
          <div className="flex items-center gap-0.5 rounded-lg border bg-card p-0.5">
            {CALENDAR_VIEWS.filter((v) => views.includes(v.value)).map((v) => (
              <button
                key={v.value}
                type="button"
                onClick={() => setPickedView(v.value)}
                aria-pressed={view === v.value}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
                  view === v.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {toolbarExtra}

      {/* ---------------- Grid ---------------- */}
      {view === "month" ? (
        <MonthGrid range={range.days} anchor={anchor} byDay={byDay} timeZone={timeZone} onPickDay={(day) => { setAnchor(day); setPickedView("day"); }} />
      ) : (
        <TimeGrid
          days={range.days}
          byDay={byDay}
          timeZone={timeZone}
          startHour={startHour}
          endHour={endHour}
          singleDay={view === "day"}
        />
      )}

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          {emptyLabel}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Day / week / work week. One scrollable hour grid with blocks placed by
 * start time and sized by duration, so a 90-minute class visibly takes
 * more room than a 30-minute one.
 */
function TimeGrid({
  days,
  byDay,
  timeZone,
  startHour,
  endHour,
  singleDay,
}: {
  days: string[];
  byDay: Map<string, CalendarEvent[]>;
  timeZone: string;
  startHour: number;
  endHour: number;
  singleDay: boolean;
}) {
  const hours = Array.from({ length: Math.max(1, endHour - startHour) }, (_, i) => startHour + i);
  const height = hours.length * HOUR_HEIGHT;

  return (
    <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
      <div className={cn("min-w-full", singleDay ? "" : "min-w-[42rem]")}>
        {/* Day headers */}
        {!singleDay ? (
          <div
            className="grid border-b"
            style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))` }}
          >
            <div />
            {days.map((day) => (
              <div
                key={day}
                className={cn(
                  "flex flex-col items-center gap-0.5 border-l px-1 py-2",
                  isToday(day, timeZone) && "bg-primary-subtle",
                )}
              >
                <span className="text-[11px] font-medium uppercase text-muted-foreground">
                  {WEEKDAY_SHORT[new Date(`${day}T12:00:00Z`).getUTCDay()]}
                </span>
                <span className={cn("tnum text-sm font-semibold", isToday(day, timeZone) && "text-primary")}>
                  {day.slice(8)}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        <div
          className="relative grid"
          style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))`, height }}
        >
          {/* Hour labels and lines */}
          <div className="relative">
            {hours.map((hour, i) => (
              <div
                key={hour}
                className="absolute right-2 -translate-y-1/2 text-[11px] text-muted-foreground tnum"
                style={{ top: i * HOUR_HEIGHT }}
              >
                {String(hour).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {days.map((day) => (
            <div key={day} className="relative border-l">
              {hours.map((hour, i) => (
                <div
                  key={hour}
                  className="absolute inset-x-0 border-t border-border/60"
                  style={{ top: i * HOUR_HEIGHT }}
                />
              ))}

              {(byDay.get(day) ?? []).map((event) => {
                const top =
                  (minutesIntoDay(new Date(event.startAt), timeZone) - startHour * 60) *
                  (HOUR_HEIGHT / 60);
                const durationMinutes = Math.max(
                  20,
                  (new Date(event.endAt).getTime() - new Date(event.startAt).getTime()) / 60000,
                );
                return (
                  <EventBlock
                    key={event.id}
                    event={event}
                    timeZone={timeZone}
                    style={{ top, height: durationMinutes * (HOUR_HEIGHT / 60) - 4 }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EventBlock({
  event,
  timeZone,
  style,
}: {
  event: CalendarEvent;
  timeZone: string;
  style: React.CSSProperties;
}) {
  const time = new Intl.DateTimeFormat("es-UY", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(event.startAt));

  const body = (
    <>
      <span className="tnum text-[11px] font-medium opacity-80">{time}</span>
      {/* The title links separately so staff can jump to the service
          without losing the ability to open the slot itself. */}
      {event.titleHref ? (
        <Link
          href={event.titleHref}
          onClick={(e) => e.stopPropagation()}
          className="truncate text-xs font-semibold underline-offset-2 hover:underline"
        >
          {event.title}
        </Link>
      ) : (
        <span className="truncate text-xs font-semibold">{event.title}</span>
      )}
      <span className="tnum truncate text-[11px] opacity-80">{event.meta}</span>
    </>
  );

  const className = cn(
    "absolute inset-x-1 flex flex-col gap-0.5 overflow-hidden rounded-lg border px-1.5 py-1 text-left transition-shadow",
    TONE_BG[event.tone],
    event.muted && "opacity-60",
    event.href && "hover:shadow-raised",
  );

  const colored = event.color
    ? ({ borderLeftWidth: 3, borderLeftColor: event.color } as React.CSSProperties)
    : undefined;

  if (!event.href) {
    return (
      <div className={className} style={{ ...style, ...colored }}>
        {body}
      </div>
    );
  }

  return (
    <Link href={event.href} className={className} style={{ ...style, ...colored }}>
      {body}
    </Link>
  );
}

/** Traditional month grid; a day with too many events collapses to "+N más". */
function MonthGrid({
  range,
  anchor,
  byDay,
  timeZone,
  onPickDay,
}: {
  range: string[];
  anchor: string;
  byDay: Map<string, CalendarEvent[]>;
  timeZone: string;
  onPickDay: (day: string) => void;
}) {
  const MAX_PER_DAY = 3;

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-card">
      <div className="grid grid-cols-7 border-b">
        {WEEKDAY_SHORT.slice(1).concat(WEEKDAY_SHORT[0]!).map((label) => (
          <div key={label} className="px-2 py-2 text-center text-[11px] font-medium uppercase text-muted-foreground">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {range.map((day) => {
          const dayEvents = byDay.get(day) ?? [];
          const shown = dayEvents.slice(0, MAX_PER_DAY);
          const rest = dayEvents.length - shown.length;
          const outside = !isSameMonth(day, anchor);

          return (
            <button
              key={day}
              type="button"
              onClick={() => onPickDay(day)}
              className={cn(
                "flex min-h-24 flex-col gap-1 border-b border-l p-1.5 text-left transition-colors hover:bg-muted/50",
                outside && "bg-muted/30",
              )}
            >
              <span
                className={cn(
                  "tnum text-xs font-medium",
                  outside ? "text-muted-foreground/60" : "text-muted-foreground",
                  isToday(day, timeZone) &&
                    "flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground",
                )}
              >
                {day.slice(8)}
              </span>

              {shown.map((event) => (
                <span
                  key={event.id}
                  className={cn(
                    "flex items-center gap-1 truncate rounded px-1 py-0.5 text-[11px]",
                    TONE_BG[event.tone],
                  )}
                  style={
                    event.color ? { borderLeftWidth: 2, borderLeftColor: event.color } : undefined
                  }
                >
                  <span className="truncate">{event.title}</span>
                </span>
              ))}

              {rest > 0 ? (
                <span className="px-1 text-[11px] font-medium text-muted-foreground">+{rest} más</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
