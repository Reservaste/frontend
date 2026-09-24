import { describe, expect, it } from "vitest";
import { inclusiveDays, round2 } from "./billing-period";

describe("inclusiveDays", () => {
  it("counts a normal multi-day range inclusive of both ends", () => {
    expect(inclusiveDays("2027-03-01", "2027-03-10")).toBe(10);
  });

  it("counts a single day as 1", () => {
    expect(inclusiveDays("2027-03-05", "2027-03-05")).toBe(1);
  });

  it.each([
    ["", "2027-03-10"],
    ["2027-03-01", ""],
    ["2027-03", "2027-03-10"],
    ["2027-03-01", "2027-03-1"],
  ])("returns null for an incomplete date (%s, %s)", (from, to) => {
    expect(inclusiveDays(from, to)).toBeNull();
  });

  it("returns null for a well-formed but invalid date (Invalid Date)", () => {
    expect(inclusiveDays("2027-13-40", "2027-03-10")).toBeNull();
    expect(inclusiveDays("2027-03-01", "2027-13-40")).toBeNull();
  });

  it("returns null for an inverted range", () => {
    expect(inclusiveDays("2027-03-10", "2027-03-01")).toBeNull();
  });

  it("counts correctly across a month/year boundary", () => {
    expect(inclusiveDays("2027-12-25", "2028-01-05")).toBe(12);
  });
});

describe("round2", () => {
  it("keeps values that already have two decimals or fewer", () => {
    expect(round2(10)).toBe(10);
    expect(round2(10.5)).toBe(10.5);
    expect(round2(10.55)).toBe(10.55);
  });

  it("rounds the third decimal up", () => {
    expect(round2(1700.005)).toBe(1700.01);
  });

  it("rounds the third decimal down", () => {
    expect(round2(1700.004)).toBe(1700);
  });

  it("handles zero and negative values without breaking", () => {
    expect(round2(0)).toBe(0);
    expect(round2(-5.255)).toBe(-5.25);
  });
});
