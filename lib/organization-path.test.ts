import { describe, expect, it } from "vitest";
import { organizationPath } from "./organization-path";

describe("organizationPath", () => {
  it("builds the public agenda path of an organization", () => {
    expect(organizationPath("iron-gym")).toBe("/iron-gym");
  });

  it("accepts digits and multiple hyphens", () => {
    expect(organizationPath("pilates-estudio-3")).toBe("/pilates-estudio-3");
  });

  it("returns null when there is no slug", () => {
    expect(organizationPath(null)).toBeNull();
    expect(organizationPath(undefined)).toBeNull();
    expect(organizationPath("")).toBeNull();
  });

  it("refuses anything that could escape the intended page", () => {
    // None of these can exist in `organizations.slug`; the point is that
    // if one ever did, the redirect built from it would not leave the site
    // or land somewhere else entirely.
    expect(organizationPath("/evil.com")).toBeNull();
    expect(organizationPath("evil.com")).toBeNull();
    expect(organizationPath("org/../admin")).toBeNull();
    expect(organizationPath("org\\evil")).toBeNull();
    expect(organizationPath("Iron-Gym")).toBeNull();
    expect(organizationPath("iron gym")).toBeNull();
  });
});
