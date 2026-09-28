import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  formatRangeLabel,
  hourBounds,
  isSameMonth,
  localDayKey,
  minutesIntoDay,
  parseAnchorKey,
  parseCalendarView,
  rangeFor,
  shiftAnchor,
  startOfMonth,
  startOfWeek,
  weekdayOf,
} from "./calendar";

const MONTEVIDEO = "America/Montevideo";

describe("localDayKey", () => {
  it("counts the day in the organization's timezone, not UTC", () => {
    // 01:30 UTC on the 22nd is still the 21st in Montevideo (UTC-3).
    // Getting this wrong puts a late class on the wrong day of the week.
    const instant = new Date("2026-09-22T01:30:00Z");
    expect(localDayKey(instant, "UTC")).toBe("2026-09-22");
    expect(localDayKey(instant, MONTEVIDEO)).toBe("2026-09-21");
  });
});

describe("minutesIntoDay", () => {
  it("places the block by local wall-clock time", () => {
    // 12:00 UTC is 09:00 in Montevideo: the 09:00 class.
    expect(minutesIntoDay(new Date("2026-09-21T12:00:00Z"), MONTEVIDEO)).toBe(9 * 60);
    expect(minutesIntoDay(new Date("2026-09-21T12:00:00Z"), "UTC")).toBe(12 * 60);
  });
});

describe("addDays / addMonths", () => {
  it("crosses month and year boundaries", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addMonths("2026-01-31", 1)).toBe("2026-03-03");
  });
});

describe("startOfWeek", () => {
  it("weeks start on Monday", () => {
    // 2026-09-21 is a Monday.
    expect(startOfWeek("2026-09-21")).toBe("2026-09-21");
    expect(startOfWeek("2026-09-25")).toBe("2026-09-21");
    // Sunday belongs to the week that started the Monday before it, not
    // to the one about to begin.
    expect(startOfWeek("2026-09-27")).toBe("2026-09-21");
    expect(startOfWeek("2026-09-28")).toBe("2026-09-28");
  });
});

describe("weekdayOf", () => {
  it("matches JS getDay(), which is what schedule_rules stores", () => {
    expect(weekdayOf("2026-09-20")).toBe(0);
    expect(weekdayOf("2026-09-21")).toBe(1);
    expect(weekdayOf("2026-09-26")).toBe(6);
  });
});

describe("rangeFor", () => {
  it("day covers one day", () => {
    const range = rangeFor("day", "2026-09-23");
    expect(range.days).toEqual(["2026-09-23"]);
  });

  it("week covers Monday to Sunday", () => {
    const range = rangeFor("week", "2026-09-23");
    expect(range.days).toHaveLength(7);
    expect(range.from).toBe("2026-09-21");
    expect(range.to).toBe("2026-09-27");
  });

  it("workweek drops the weekend", () => {
    const range = rangeFor("workweek", "2026-09-23");
    expect(range.days).toHaveLength(5);
    expect(range.to).toBe("2026-09-25");
  });

  it("month spans whole weeks so the grid is rectangular", () => {
    const range = rangeFor("month", "2026-09-15");
    expect(range.days.length % 7).toBe(0);
    // September 2026 starts on a Tuesday, so the grid opens on Aug 31.
    expect(range.from).toBe("2026-08-31");
    expect(range.days).toContain("2026-09-01");
    expect(range.days).toContain("2026-09-30");
  });
});

describe("shiftAnchor", () => {
  it("steps by the unit the view shows", () => {
    expect(shiftAnchor("day", "2026-09-21", 1)).toBe("2026-09-22");
    expect(shiftAnchor("week", "2026-09-21", 1)).toBe("2026-09-28");
    expect(shiftAnchor("workweek", "2026-09-21", -1)).toBe("2026-09-14");
    expect(shiftAnchor("month", "2026-09-21", 1)).toBe("2026-10-21");
  });
});

describe("isSameMonth / startOfMonth", () => {
  it("tells the leading and trailing days of a month grid apart", () => {
    expect(startOfMonth("2026-09-23")).toBe("2026-09-01");
    expect(isSameMonth("2026-08-31", "2026-09-15")).toBe(false);
    expect(isSameMonth("2026-09-01", "2026-09-15")).toBe(true);
  });
});

describe("formatRangeLabel", () => {
  it("names what you are looking at", () => {
    expect(formatRangeLabel("day", rangeFor("day", "2026-09-21"))).toContain("21");
    expect(formatRangeLabel("month", rangeFor("month", "2026-09-15"))).toContain("2026");
    expect(formatRangeLabel("week", rangeFor("week", "2026-09-21"))).toContain("–");
  });
});

describe("parseCalendarView", () => {
  it("accepts any value CALENDAR_VIEWS lists", () => {
    expect(parseCalendarView("day")).toBe("day");
    expect(parseCalendarView("week")).toBe("week");
    expect(parseCalendarView("workweek")).toBe("workweek");
    expect(parseCalendarView("month")).toBe("month");
  });

  it("falls back to undefined for anything else, never throws", () => {
    expect(parseCalendarView(undefined)).toBeUndefined();
    expect(parseCalendarView("")).toBeUndefined();
    expect(parseCalendarView("semana")).toBeUndefined();
    expect(parseCalendarView("<script>")).toBeUndefined();
  });
});

describe("parseAnchorKey", () => {
  it("accepts a well-formed day key", () => {
    expect(parseAnchorKey("2026-09-21")).toBe("2026-09-21");
  });

  it("falls back to undefined for anything malformed or missing", () => {
    expect(parseAnchorKey(undefined)).toBeUndefined();
    expect(parseAnchorKey("")).toBeUndefined();
    expect(parseAnchorKey("2026-9-21")).toBeUndefined();
    expect(parseAnchorKey("not-a-date")).toBeUndefined();
    expect(parseAnchorKey("2026-09-21T00:00:00Z")).toBeUndefined();
  });

  it("rejects a month or day outside the calendar, not just outside the regex", () => {
    // A hand-edited URL (or `Date`'s own habit of quietly rolling an
    // out-of-range part into the next unit) must never reach `rangeFor`
    // and crash `toISOString()` -- these all have the right *shape* and
    // must still fall back to the caller's default.
    expect(parseAnchorKey("2026-13-01")).toBeUndefined();
    expect(parseAnchorKey("2026-00-15")).toBeUndefined();
    expect(parseAnchorKey("2026-01-32")).toBeUndefined();
    expect(parseAnchorKey("2026-01-00")).toBeUndefined();
  });

  it("rejects a day that doesn't exist in that month, not the day `Date` rolls it into", () => {
    // 2026 is not a leap year: no Feb 29th, let alone the 30th.
    expect(parseAnchorKey("2026-02-30")).toBeUndefined();
    expect(parseAnchorKey("2026-02-29")).toBeUndefined();
    // 2028 is a leap year: the 29th is real, the 30th still isn't.
    expect(parseAnchorKey("2028-02-29")).toBe("2028-02-29");
    expect(parseAnchorKey("2028-02-30")).toBeUndefined();
  });
});

describe("hourBounds", () => {
  it("frames the grid around what is actually scheduled", () => {
    expect(hourBounds([9 * 60, 10 * 60])).toEqual({ startHour: 8, endHour: 11 });
  });

  it("falls back to a normal working span when nothing is scheduled", () => {
    expect(hourBounds([])).toEqual({ startHour: 7, endHour: 22 });
  });

  it("never runs past the ends of the day", () => {
    expect(hourBounds([0, 23 * 60 + 59]).startHour).toBe(0);
    expect(hourBounds([0, 23 * 60 + 59]).endHour).toBe(24);
  });
});
