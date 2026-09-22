"use client";

import { useState } from "react";
import { COUNTRIES, DEFAULT_TIMEZONE, countryForTimezone } from "@/lib/timezones";
import { Label } from "@/components/ui/label";
import { Field, FieldHint } from "@/components/ui/form";
import { Select } from "@/components/ui/select";

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
      <Field>
        <Label htmlFor={`${name}-country`}>País</Label>
        <Select
          id={`${name}-country`}
          value={countryCode}
          disabled={disabled}
          touch
          onChange={(event) => {
            const next = COUNTRIES.find((c) => c.code === event.target.value)!;
            setCountryCode(next.code);
            // Always land on a zone that belongs to the country just
            // picked, otherwise the hidden field keeps the old country's
            // zone and the schedule silently generates in the wrong time.
            setTimezone(next.zones[0]!.iana);
          }}
        >
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field>
        <Label htmlFor={`${name}-city`}>Ciudad</Label>
        <Select
          id={`${name}-city`}
          value={timezone}
          disabled={disabled || onlyOneCity}
          touch
          onChange={(event) => setTimezone(event.target.value)}
        >
          {country.zones.map((zone) => (
            <option key={zone.iana} value={zone.iana}>
              {zone.city}
            </option>
          ))}
        </Select>
        {onlyOneCity ? (
          <FieldHint>{country.name} tiene una sola zona horaria.</FieldHint>
        ) : null}
      </Field>

      <input type="hidden" name={name} value={timezone} />
    </div>
  );
}
