import { describe, expect, it } from "vitest";
import { CATALOG, TIER_ORDER } from "./catalog";

describe("catalog", () => {
  it("is ordered from lightest to heaviest tier", () => {
    expect(CATALOG.map((m) => m.tier)).toEqual(TIER_ORDER);
  });

  it("has smaller downloads and fewer bytes read per token for q4f16 than q4", () => {
    for (const m of CATALOG) {
      expect(m.downloadMB.q4f16).toBeLessThan(m.downloadMB.q4);
      expect(m.activeMB.q4f16).toBeLessThan(m.activeMB.q4);
      expect(m.activeMB.q4f16).toBeLessThanOrEqual(m.downloadMB.q4f16);
    }
  });

  it("gets heavier and slower up the ladder", () => {
    const sizes = CATALOG.map((m) => m.downloadMB.q4f16);
    expect(sizes).toEqual([...sizes].sort((a, b) => a - b));
  });

  it("pins every model to a full commit hash", () => {
    for (const m of CATALOG) expect(m.revision).toMatch(/^[0-9a-f]{40}$/);
  });

  it("only uses Apache-2.0 models", () => {
    for (const m of CATALOG) expect(m.license).toBe("Apache-2.0");
  });

  it("only claims speeds that were measured", () => {
    expect(CATALOG.every((m) => m.measured)).toBe(true);
  });
});
