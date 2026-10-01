"use client";

import { useMemo, useState } from "react";
import { cn } from "cn";
import { UserIcon } from "@/components/icons";
import { ScheduleCalendar, type CalendarEvent } from "./schedule-calendar";

export interface PublicSlot {
  slotOccurrenceId: string;
  serviceId: string;
  serviceName: string;
  serviceColor: string | null;
  /** ADR-0048: opaque, always present -- the actual resource of this slot. */
  resourceId: string;
  /**
   * ADR-0048: only set when the organization opted into
   * `public_resource_names`; otherwise always null. The backend already
   * decided this -- this component only renders what it is given, never
   * decides when a name should show.
   */
  resourceName: string | null;
  startAt: string;
  endAt: string;
  /** "4 lugares disponibles", "Completo" -- already respecting ADR-0008. */
  availability: string;
  full: boolean;
  /**
   * Last few seats, per `availabilityTone` (`components/status.tsx`) --
   * the same LOW/FULL vocabulary the database's `LIMITED` disclosure mode
   * already uses, never a raw count. False (not just falsy/absent) so a
   * caller can't confuse "definitely not low" with "mode doesn't say".
   */
  low: boolean;
  /**
   * ADR-0025: a seat freed by someone's own on-time release, in the last
   * 72h. Already null (not false) where ADR-0008 suppresses it (BOOLEAN
   * mode, capacity 1) -- this component only renders what it is given.
   */
  recentlyReleased?: boolean | null;
}

/**
 * The booking calendar a visitor sees: the same grid the admin agenda
 * uses, with public labels and links (ADR-0023).
 *
 * Blocks sit on the hour grid by start time and are sized by duration,
 * so the page reads like a calendar rather than a list that happens to
 * be sorted by time. A full slot is rendered without a link: there is
 * nothing to click through to.
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
  const [serviceFilter, setServiceFilter] = useState<string | null>(null);
  const [resourceFilter, setResourceFilter] = useState<string | null>(null);

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

  // ADR-0048: only resources whose name actually came through -- a slot
  // with `resourceName: null` (flag off, or no name set) never contributes
  // an entry, so an organization that didn't opt in ends up with an empty
  // list and no filter at all, without this component knowing the flag
  // exists.
  const resources = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const slot of slots) {
      if (slot.resourceName && !map.has(slot.resourceId)) {
        map.set(slot.resourceId, { id: slot.resourceId, name: slot.resourceName });
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [slots]);

  const events: CalendarEvent[] = useMemo(
    () =>
      slots
        .filter((slot) => !serviceFilter || slot.serviceId === serviceFilter)
        .filter((slot) => !resourceFilter || slot.resourceId === resourceFilter)
        .map((slot) => ({
          id: slot.slotOccurrenceId,
          startAt: slot.startAt,
          endAt: slot.endAt,
          title: slot.serviceName,
          color: slot.serviceColor,
          // ADR-0025: no number, no name, no timestamp -- just a plain
          // marker next to the availability text, the same one anyone
          // polling the page would already be able to infer.
          meta: slot.recentlyReleased ? `${slot.availability} · Cupo liberado` : slot.availability,
          // Full stays neutral rather than a "danger" red: a slot filling
          // up is nobody's fault, and booking-reasons.ts already treats
          // SLOT_FULL as a neutral outcome for the same reason -- a red
          // block here would read as an error the visitor caused.
          tone: slot.full ? "neutral" : slot.low ? "warning" : "success",
          // A full slot is not a dead link, it is simply not a link.
          href: slot.full
            ? null
            : `/${organizationSlug}/reservar/confirmar?slot=${slot.slotOccurrenceId}`,
          muted: slot.full,
        })),
    [slots, serviceFilter, resourceFilter, organizationSlug],
  );

  const serviceFilterRow =
    services.length > 1 ? (
      // Filled chips, not hairline-bordered ones: the unselected state is a
      // solid neutral pill (real weight at rest) and the selected one adds
      // a resting shadow on top of the brand fill, rather than a border
      // colour being the only thing that changed.
      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
        <button
          type="button"
          onClick={() => setServiceFilter(null)}
          className={cn(
            "shrink-0 rounded-full px-3.5 py-2 text-sm font-medium transition-all",
            serviceFilter === null
              ? "bg-primary text-primary-foreground shadow-card"
              : "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground",
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
              "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-all",
              serviceFilter === service.id
                ? "bg-primary text-primary-foreground shadow-card"
                : "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground",
            )}
          >
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: service.color ?? "var(--primary)" }}
            />
            {service.name}
          </button>
        ))}
      </div>
    ) : null;

  // ADR-0048: "con quién" -- only rendered when 2+ named resources show up
  // in the data. At 0 (flag off, or resources aren't people) or 1 (a single
  // professional) there is nothing to choose between, so the filter adds
  // noise instead of a choice. Same chip visuals as the service row above,
  // stacked as its own scrollable line rather than merged into one row: the
  // two filters are independent axes (service AND resource), not one list,
  // and a single row would force an ambiguous reading when both are long.
  const resourceFilterRow =
    resources.length > 1 ? (
      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
        <button
          type="button"
          onClick={() => setResourceFilter(null)}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-all",
            resourceFilter === null
              ? "bg-primary text-primary-foreground shadow-card"
              : "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground",
          )}
        >
          <UserIcon className="size-3.5" />
          Cualquiera
        </button>
        {resources.map((resource) => (
          <button
            key={resource.id}
            type="button"
            onClick={() => setResourceFilter(resource.id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-all",
              resourceFilter === resource.id
                ? "bg-primary text-primary-foreground shadow-card"
                : "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground",
            )}
          >
            <UserIcon className="size-3.5" />
            {resource.name}
          </button>
        ))}
      </div>
    ) : null;

  const filter =
    serviceFilterRow || resourceFilterRow ? (
      <div className="flex flex-col gap-2">
        {serviceFilterRow}
        {resourceFilterRow}
      </div>
    ) : null;

  return (
    <ScheduleCalendar
      events={events}
      timeZone={timeZone}
      // No month view: a visitor is choosing a time this week or the
      // next, not surveying a quarter.
      views={["day", "week"]}
      initialView="week"
      responsiveDefault="day"
      openOnFirstEvent
      toolbarExtra={filter}
      emptyLabel="No hay horarios disponibles en este período."
    />
  );
}
