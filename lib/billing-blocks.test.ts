import { describe, expect, it } from "vitest";
import { calendarBlocks, formatPeriodRange, periodNoun, suggestedAmount } from "./billing-blocks";

describe("calendarBlocks", () => {
  it("splits the year into quarters from January", () => {
    expect(calendarBlocks(3, 1)).toEqual(["ene–mar", "abr–jun", "jul–sep", "oct–dic"]);
  });

  it("wraps around the year from a later anchor", () => {
    expect(calendarBlocks(6, 3)).toEqual(["mar–ago", "sep–feb"]);
    expect(calendarBlocks(12, 3)).toEqual(["mar–feb"]);
  });

  it("returns nothing for a length that does not divide the year", () => {
    expect(calendarBlocks(5, 1)).toEqual([]);
  });
});

describe("formatPeriodRange", () => {
  it("collapses a period within one year", () => {
    expect(formatPeriodRange("2026-07-01", "2026-09-30")).toBe("jul–sep 2026");
  });

  it("names both years when the period crosses one", () => {
    expect(formatPeriodRange("2026-11-01", "2027-01-31")).toBe("nov 2026–ene 2027");
  });

  it("says a single month once", () => {
    expect(formatPeriodRange("2026-09-01", "2026-09-30")).toBe("sep 2026");
  });
});

describe("periodNoun", () => {
  it("has a word for the usual lengths", () => {
    expect(periodNoun(3)).toBe("trimestre");
    expect(periodNoun(6)).toBe("semestre");
    expect(periodNoun(5)).toBe("período de 5 meses");
  });
});

describe("suggestedAmount", () => {
  const quote = {
    price: 3000,
    proratedPrice: 1000,
    prorated: true,
    periodStart: "2026-07-01",
    periodEnd: "2026-09-30",
  };

  it("suggests the prorated price for a first sign-up mid-cycle", () => {
    expect(suggestedAmount(quote, [])).toEqual({ amount: 1000, mode: "prorated" });
  });

  it("suggests the full price when the period is already paid (a plan change)", () => {
    expect(suggestedAmount(quote, [{ periodStart: "2026-07-01", periodEnd: "2026-09-30" }])).toEqual({
      amount: 3000,
      mode: "plan-change",
    });
  });

  it("ignores payments of other periods", () => {
    expect(suggestedAmount(quote, [{ periodStart: "2026-04-01", periodEnd: "2026-06-30" }]).mode).toBe("prorated");
  });

  it("treats a partial overlap as a plan change (e.g. a monthly payment inside the quarter)", () => {
    expect(suggestedAmount(quote, [{ periodStart: "2026-08-01", periodEnd: "2026-08-31" }])).toEqual({
      amount: 3000,
      mode: "plan-change",
    });
  });

  it("does not count a payment that ends the day before the period starts", () => {
    expect(suggestedAmount(quote, [{ periodStart: "2026-06-01", periodEnd: "2026-06-30" }])).toEqual({
      amount: 1000,
      mode: "prorated",
    });
  });

  it("counts a payment that touches the period on its first or last day (inclusive bounds)", () => {
    expect(suggestedAmount(quote, [{ periodStart: "2026-06-01", periodEnd: "2026-07-01" }]).mode).toBe("plan-change");
    expect(suggestedAmount(quote, [{ periodStart: "2026-09-30", periodEnd: "2026-10-31" }]).mode).toBe("plan-change");
  });

  it("falls back to the prorated price when the server resolved no period to compare against", () => {
    expect(
      suggestedAmount({ ...quote, periodStart: null, periodEnd: null }, [
        { periodStart: "2026-07-01", periodEnd: "2026-09-30" },
      ]),
    ).toEqual({ amount: 1000, mode: "prorated" });
  });

  it("uses the list price when nothing is prorated", () => {
    expect(suggestedAmount({ ...quote, prorated: false, proratedPrice: 3000 }, [])).toEqual({
      amount: 3000,
      mode: "full",
    });
  });
});
