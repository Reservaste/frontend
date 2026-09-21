"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { cn } from "cn";
import { ChevronLeft, ChevronRight } from "@/components/icons";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  WEEKDAY_SHORT,
  addDays,
  formatDayLong,
  isToday,
  localDayKey,
  rangeFor,
  todayKey,
} from "@/lib/calendar";

export interface PublicSlot {
  slotOccurrenceId: string;
  serviceId: string;
  serviceName: string;
  serviceColor: string | null;
  startAt: string;
  endAt: string;
  /** "4 lugares disponibles", "Completo" -- already respecting ADR-0008. */
  availability: string;
  full: boolean;
}

/**
 * The booking calendar a customer sees.
 *
 * Deliberately not the admin grid shrunk down. On a phone this is a day
 * strip plus a list, because seven columns of an hour grid on a 390px
 * screen is unusable; the week grid only appears where there is room for
 * it. What a visitor needs is "what can I take, and is there room", not a
 * faithful reproduction of a calendar app.
 */
export function PublicCalendar({
  organizationSlug,
  slots,
  timeZone,
}: {
  organizationSlug: string;
  slots: PublicSlot[];
  timeZone: string;
}) {
  // Opens on the first day that actually has something, not on today.
  // A business that is closed on Mondays would otherwise greet every
  // Monday visitor with "no hay horarios este día".
  const [anchor, setAnchor] = useState(() => {
    const today = todayKey(timeZone);
    const upcoming = slots
      .map((slot) => localDayKey(new Date(slot.startAt), timeZone))
      .filter((day) => day >= today)
      .sort();
    return upcoming[0] ?? today;
  });
  const [serviceFilter, setServiceFilter] = useState<string | null>(null);

  const services = useMemo(() => {
    const map = new Map<string, { id: string; name: string; color: string | null }>();
    for (const slot of slots) {
      if (!map.has(slot.serviceId)) {
        map.set(slot.serviceId, {
          id: slot.serviceId,
          name: slot.serviceName,
          color: slot.serviceColor,
        });
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [slots]);

  const byDay = useMemo(() => {
    const map = new Map<string, PublicSlot[]>();
    for (const slot of slots) {
      if (serviceFilter && slot.serviceId !== serviceFilter) continue;
      const key = localDayKey(new Date(slot.startAt), timeZone);
      const list = map.get(key);
      if (list) list.push(slot);
      else map.set(key, [slot]);
    }
    for (const list of map.values()) list.sort((a, b) => a.startAt.localeCompare(b.startAt));
    return map;
  }, [slots, serviceFilter, timeZone]);

  const week = rangeFor("week", anchor).days;
  const selectedDay = week.includes(anchor) ? anchor : week[0]!;

  const time = (iso: string) =>
    new Intl.DateTimeFormat("es-UY", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(iso));

  return (
    <div className="flex flex-col gap-4">
      {services.length > 1 ? (
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
          <button
            type="button"
            onClick={() => setServiceFilter(null)}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors",
              serviceFilter === null
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-card hover:bg-muted",
            )}
          >
            Todos
          </button>
          {services.map((service) => (
            <button
              key={service.id}
              type="button"
              onClick={() => setServiceFilter(service.id)}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors",
                serviceFilter === service.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card hover:bg-muted",
              )}
            >
              {service.name}
            </button>
          ))}
        </div>
      ) : null}

      {/* Week navigation, shared by both layouts. */}
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Semana anterior"
          onClick={() => setAnchor(addDays(anchor, -7))}
        >
          <ChevronLeft />
        </Button>
        <Button
          variant={anchor === todayKey(timeZone) ? "secondary" : "outline"}
          size="sm"
          onClick={() => setAnchor(todayKey(timeZone))}
        >
          Hoy
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Semana siguiente"
          onClick={() => setAnchor(addDays(anchor, 7))}
        >
          <ChevronRight />
        </Button>
      </div>

      {/* Day strip: the whole navigation on a phone, and a useful summary
          above the grid on a desktop. */}
      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
        {week.map((day) => {
          const count = (byDay.get(day) ?? []).length;
          const active = day === selectedDay;
          return (
            <button
              key={day}
              type="button"
              onClick={() => setAnchor(day)}
              className={cn(
                "flex min-w-16 shrink-0 flex-col items-center gap-0.5 rounded-xl border px-3 py-2.5 transition-colors",
                active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
              )}
            >
              <span className="text-[11px] font-medium uppercase opacity-80">
                {WEEKDAY_SHORT[new Date(`${day}T12:00:00Z`).getUTCDay()]}
              </span>
              <span className="tnum text-lg font-semibold leading-none">{day.slice(8)}</span>
              <span className={cn("text-[11px]", active ? "opacity-80" : "text-muted-foreground")}>
                {count === 0 ? "—" : count}
              </span>
              {isToday(day, timeZone) && !active ? (
                <span className="size-1 rounded-full bg-primary" />
              ) : null}
            </button>
          );
        })}
      </div>

      <h2 className="text-sm font-medium capitalize text-muted-foreground">
        {formatDayLong(selectedDay)}
      </h2>

      <SlotList
        slots={byDay.get(selectedDay) ?? []}
        organizationSlug={organizationSlug}
        time={time}
      />
    </div>
  );
}

function SlotList({
  slots,
  organizationSlug,
  time,
}: {
  slots: PublicSlot[];
  organizationSlug: string;
  time: (iso: string) => string;
}) {
  if (slots.length === 0) {
    return (
      <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
        No hay horarios este día.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {slots.map((slot) => (
        <li
          key={slot.slotOccurrenceId}
          className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4 shadow-card"
          style={
            slot.serviceColor
              ? { borderLeftWidth: 4, borderLeftColor: slot.serviceColor }
              : undefined
          }
        >
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {/* Time first and largest: choosing a slot is choosing a
                time, the service name is confirmation. */}
            <span className="tnum text-lg font-semibold leading-none">
              {time(slot.startAt)}
              <span className="text-sm font-normal text-muted-foreground">
                {" – "}
                {time(slot.endAt)}
              </span>
            </span>
            <span className="truncate text-sm font-medium">{slot.serviceName}</span>
            <span
              className={cn("text-xs", slot.full ? "text-destructive" : "text-success")}
            >
              {slot.availability}
            </span>
          </div>

          {slot.full ? (
            <span className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
              Completo
            </span>
          ) : (
            <Link
              href={`/${organizationSlug}/reservar/confirmar?slot=${slot.slotOccurrenceId}`}
              className={buttonVariants({ size: "sm" })}
            >
              Reservar
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}
