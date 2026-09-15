"use client";

import { useState } from "react";
import { COUNTRIES, DEFAULT_TIMEZONE, countryForTimezone } from "@/lib/timezones";
import { Label } from "@/components/ui/label";

const selectClass =
  "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60";

/**
 * Two selects, one hidden field. The form still submits an IANA zone --
 * that's what the schedule generator needs (ADR-0014) -- but nobody has
 * to know that "America/Argentina/Cordoba" is a thing.
 */
export function TimezonePicker({
  name = "timezone",
  defaultValue = DEFAULT_TIMEZONE,
  disabled,
}: {
  name?: string;
  defaultValue?: string;
  disabled?: boolean;
}) {
  const initialCountry = countryForTimezone(defaultValue) ?? COUNTRIES[0]!;
  const [countryCode, setCountryCode] = useState(initialCountry.code);
  const [timezone, setTimezone] = useState(
    initialCountry.zones.some((z) => z.iana === defaultValue) ? defaultValue : initialCountry.zones[0]!.iana,
  );

  const country = COUNTRIES.find((c) => c.code === countryCode) ?? COUNTRIES[0]!;
  const onlyOneCity = country.zones.length === 1;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${name}-country`}>País</Label>
        <select
          id={`${name}-country`}
          value={countryCode}
          disabled={disabled}
          onChange={(event) => {
            const next = COUNTRIES.find((c) => c.code === event.target.value)!;
            setCountryCode(next.code);
            // Always land on a zone that belongs to the country just
            // picked, otherwise the hidden field keeps the old country's
            // zone and the schedule silently generates in the wrong time.
            setTimezone(next.zones[0]!.iana);
          }}
          className={selectClass}
        >
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${name}-city`}>Ciudad</Label>
        <select
          id={`${name}-city`}
          value={timezone}
          disabled={disabled || onlyOneCity}
          onChange={(event) => setTimezone(event.target.value)}
          className={selectClass}
        >
          {country.zones.map((zone) => (
            <option key={zone.iana} value={zone.iana}>
              {zone.city}
            </option>
          ))}
        </select>
        {onlyOneCity ? (
          <p className="text-xs text-muted-foreground">{country.name} tiene una sola zona horaria.</p>
        ) : null}
      </div>

      <input type="hidden" name={name} value={timezone} />
    </div>
  );
}
