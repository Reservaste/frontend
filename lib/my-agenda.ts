// The pure bits of the customer portal's agenda (/me).
//
// A person can be a Customer of several businesses at once (ADR-0006 exists
// precisely because of that), and a calendar grid only means one thing if
// every block on it belongs to the same timezone (ADR-0014). So the portal
// agenda always renders *one* organization at a time, and these helpers
// answer the two questions that decision creates: which businesses can be
// picked, and which one to open on.
//
// Nothing here talks to the database or computes availability -- capacity
// is shown, never calculated.

export interface CustomerOrganizationOption {
  slug: string;
  name: string;
  /**
   * Only known when the person has at least one booking there --
   * `my_customer_organizations()` doesn't return it. Null means "ask
   * `organizations_public` for it".
   */
  timezone: string | null;
}

interface OrganizationRow {
  organizationSlug: string;
  organizationName: string;
}

interface BookingRow extends OrganizationRow {
  organizationTimezone: string;
  startAt: string;
  status: "CONFIRMED" | "CANCELLED" | "NOT_GENERATED";
}

/**
 * Every business this portal can show an agenda for.
 *
 * Two sources on purpose. `my_customer_organizations()` covers someone who
 * was just activated and has never booked (the whole reason it exists), and
 * the bookings cover the opposite corner: a Customer that was deactivated
 * afterwards still has history, and dropping their past classes off the
 * calendar without a word would be worse than showing a business they can
 * no longer book at.
 */
export function customerOrganizationOptions(
  customerOrganizations: readonly OrganizationRow[],
  bookings: readonly BookingRow[],
): CustomerOrganizationOption[] {
  const bySlug = new Map<string, CustomerOrganizationOption>();

  for (const org of customerOrganizations) {
    bySlug.set(org.organizationSlug, {
      slug: org.organizationSlug,
      name: org.organizationName,
      timezone: null,
    });
  }

  for (const booking of bookings) {
    const existing = bySlug.get(booking.organizationSlug);
    if (existing) {
      existing.timezone ??= booking.organizationTimezone;
    } else {
      bySlug.set(booking.organizationSlug, {
        slug: booking.organizationSlug,
        name: booking.organizationName,
        timezone: booking.organizationTimezone,
      });
    }
  }

  return [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
}

/**
 * Which business the agenda opens on.
 *
 * An explicit `?org=` always wins (it is the person clicking a chip). With
 * nothing asked for, the one with the soonest class they still have ahead
 * of them -- that is what someone opening the portal is checking. Falling
 * back to alphabetical order would open on a gym they left in March
 * whenever it happens to start with an A.
 */
export function pickCustomerOrganization(
  options: readonly CustomerOrganizationOption[],
  requestedSlug: string | undefined,
  bookings: readonly BookingRow[],
  now: number,
): CustomerOrganizationOption | null {
  if (options.length === 0) return null;

  const requested = requestedSlug
    ? options.find((option) => option.slug === requestedSlug)
    : undefined;
  if (requested) return requested;

  const upcoming = bookings
    .filter((booking) => booking.status !== "CANCELLED" && new Date(booking.startAt).getTime() >= now)
    .sort((a, b) => a.startAt.localeCompare(b.startAt));

  for (const booking of upcoming) {
    const match = options.find((option) => option.slug === booking.organizationSlug);
    if (match) return match;
  }

  return options[0] ?? null;
}

/**
 * Identity of a slot as seen from two different reads.
 *
 * `my_bookings()` returns the booking, not the occurrence it belongs to --
 * there is no `slot_occurrence_id` (nor `service_id`) in its result set, so
 * a booking and the public availability row for the same class cannot be
 * matched by id today. Start instant + service name inside a single
 * organization is the closest stand-in: a customer can hold at most one
 * active booking per occurrence (ADR-0004), so the only way this collides
 * is two occurrences of the *same named service* starting at the *same
 * instant* on two different Resources.
 *
 * The cost of a collision is cosmetic and bounded: the person's own block
 * hides the duplicate availability block for that one slot. It never
 * grants, blocks or miscounts anything -- the booking path is still the
 * RPC. If `my_bookings()` ever returns the occurrence id, this should
 * become a plain id comparison.
 */
export function occurrenceKey(startAt: string, serviceName: string): string {
  return `${new Date(startAt).getTime()}|${serviceName.trim().toLowerCase()}`;
}

export interface CreditsSummary {
  /** Credits usable right now: AVAILABLE and not expired. */
  available: number;
  /** The soonest expiry among those, as the stored `date` string. */
  nextExpiry: string | null;
  /** Whether anything has ever been issued, expired or spent included. */
  hasHistory: boolean;
}

/**
 * The one-line version of /me/creditos. `status` and `isExpired` arrive
 * already decided by SQL (ADR-0025) -- this only counts them.
 */
export function summarizeCredits(
  credits: readonly { status: string; isExpired: boolean; expiresOn: string }[],
): CreditsSummary {
  const usable = credits.filter((credit) => credit.status === "AVAILABLE" && !credit.isExpired);
  const nextExpiry = usable
    .map((credit) => credit.expiresOn)
    .sort()
    .at(0);

  return {
    available: usable.length,
    nextExpiry: nextExpiry ?? null,
    hasHistory: credits.length > 0,
  };
}
