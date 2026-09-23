import { describe, expect, it } from "vitest";
import {
  customerOrganizationOptions,
  occurrenceKey,
  pickCustomerOrganization,
  summarizeCredits,
} from "./my-agenda";

const booking = (overrides: Partial<Parameters<typeof customerOrganizationOptions>[1][number]>) => ({
  organizationSlug: "gimnasio",
  organizationName: "Gimnasio",
  organizationTimezone: "America/Montevideo",
  startAt: "2026-09-24T12:00:00Z",
  status: "CONFIRMED" as const,
  ...overrides,
});

describe("customerOrganizationOptions", () => {
  it("includes a business the person was just activated in, with no bookings yet", () => {
    // my_customer_organizations() is the only source that knows about
    // someone who has never booked -- dropping it would recreate the dead
    // end the empty state was added to fix.
    const options = customerOrganizationOptions(
      [{ organizationSlug: "pilates", organizationName: "Pilates" }],
      [],
    );

    expect(options).toEqual([{ slug: "pilates", name: "Pilates", timezone: null }]);
  });

  it("keeps a business the person only has history in", () => {
    // A deactivated Customer disappears from my_customer_organizations()
    // but their past classes are still real.
    const options = customerOrganizationOptions([], [booking({})]);

    expect(options).toEqual([
      { slug: "gimnasio", name: "Gimnasio", timezone: "America/Montevideo" },
    ]);
  });

  it("does not duplicate a business present in both sources, and takes its timezone from the booking", () => {
    const options = customerOrganizationOptions(
      [{ organizationSlug: "gimnasio", organizationName: "Gimnasio" }],
      [booking({})],
    );

    expect(options).toHaveLength(1);
    expect(options[0]!.timezone).toBe("America/Montevideo");
  });

  it("sorts by name so the chips don't reshuffle between loads", () => {
    const options = customerOrganizationOptions(
      [
        { organizationSlug: "zen", organizationName: "Zen" },
        { organizationSlug: "atletica", organizationName: "Atlética" },
      ],
      [],
    );

    expect(options.map((o) => o.slug)).toEqual(["atletica", "zen"]);
  });
});

describe("pickCustomerOrganization", () => {
  const options = [
    { slug: "atletica", name: "Atlética", timezone: null },
    { slug: "zen", name: "Zen", timezone: null },
  ];
  const now = new Date("2026-09-23T12:00:00Z").getTime();

  it("honours an explicit ?org=", () => {
    expect(pickCustomerOrganization(options, "zen", [], now)?.slug).toBe("zen");
  });

  it("ignores an ?org= that isn't one of this person's businesses", () => {
    // Not a security boundary (RLS is), just refusing to render an agenda
    // for a slug that was typed into the address bar.
    expect(pickCustomerOrganization(options, "otro-gimnasio", [], now)?.slug).toBe("atletica");
  });

  it("opens on the business with the soonest upcoming class", () => {
    const picked = pickCustomerOrganization(
      options,
      undefined,
      [
        booking({ organizationSlug: "zen", startAt: "2026-09-24T12:00:00Z" }),
        booking({ organizationSlug: "atletica", startAt: "2026-09-30T12:00:00Z" }),
      ],
      now,
    );

    expect(picked?.slug).toBe("zen");
  });

  it("ignores past and cancelled classes when choosing", () => {
    const picked = pickCustomerOrganization(
      options,
      undefined,
      [
        booking({ organizationSlug: "zen", startAt: "2026-09-01T12:00:00Z" }),
        booking({ organizationSlug: "zen", startAt: "2026-09-25T12:00:00Z", status: "CANCELLED" }),
      ],
      now,
    );

    expect(picked?.slug).toBe("atletica");
  });

  it("returns null when the person is a customer of nobody", () => {
    expect(pickCustomerOrganization([], undefined, [], now)).toBeNull();
  });
});

describe("occurrenceKey", () => {
  it("matches the same class seen as a booking and as public availability", () => {
    // my_bookings() returns no slot_occurrence_id, so this is what keeps a
    // class the person is already in from being drawn twice.
    expect(occurrenceKey("2026-09-24T12:00:00Z", "Pilates")).toBe(
      occurrenceKey("2026-09-24T12:00:00.000Z", " pilates "),
    );
  });

  it("separates two different times of the same service", () => {
    expect(occurrenceKey("2026-09-24T12:00:00Z", "Pilates")).not.toBe(
      occurrenceKey("2026-09-24T13:00:00Z", "Pilates"),
    );
  });
});

describe("summarizeCredits", () => {
  it("counts only what can be used today and reports the soonest expiry", () => {
    const summary = summarizeCredits([
      { status: "AVAILABLE", isExpired: false, expiresOn: "2026-10-15" },
      { status: "AVAILABLE", isExpired: false, expiresOn: "2026-10-02" },
      { status: "AVAILABLE", isExpired: true, expiresOn: "2026-09-01" },
      { status: "CONSUMED", isExpired: false, expiresOn: "2026-09-29" },
    ]);

    expect(summary).toEqual({ available: 2, nextExpiry: "2026-10-02", hasHistory: true });
  });

  it("says nothing is usable when every credit is spent or expired", () => {
    expect(
      summarizeCredits([{ status: "CONSUMED", isExpired: false, expiresOn: "2026-09-29" }]),
    ).toEqual({ available: 0, nextExpiry: null, hasHistory: true });
  });

  it("handles someone who never had a credit", () => {
    expect(summarizeCredits([])).toEqual({ available: 0, nextExpiry: null, hasHistory: false });
  });
});
