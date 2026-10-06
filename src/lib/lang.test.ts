import { describe, expect, it } from "vitest";
import { decimal, formatBytes, formatMB } from "./format";
import { detectLang, tr } from "./lang";

describe("detectLang", () => {
  it.each([
    [["de"], "de"],
    [["de-AT", "en"], "de"],
    [["de-CH"], "de"],
    [["en-US", "de"], "de"], // any preferred German wins: a German reader can read the German text
    [["DE-de"], "de"],
    [["en-GB"], "en"],
    [["fr-FR", "es"], "en"], // everything else falls back to English
    [[], "en"],
  ] as const)("%j -> %s", (languages, expected) => {
    expect(detectLang(languages)).toBe(expected);
  });
});

describe("tr", () => {
  it("returns English when the browser language is not German (the test environment has no navigator)", () => {
    expect(tr("Start", "Starten")).toBe("Start");
  });
});

describe("decimal", () => {
  it("uses the English format when the browser is not German", () => {
    expect(decimal(3.14159)).toBe("3.1");
    expect(decimal(2, 2)).toBe("2.00");
  });
});

describe("formatBytes", () => {
  it("formats sizes for people", () => {
    expect(formatBytes(512)).toBe("1 KB");
    expect(formatBytes(570e6)).toBe("570 MB");
    expect(formatBytes(3.1e9)).toBe("3.1 GB");
  });

  it("uses decimal units, so a catalog size reads like the Hugging Face file list", () => {
    // Gemma 4 E2B q4f16: 1520 + 1591 MB of weights, measured 3131 MB in the browser cache on 2026-10-06.
    expect(formatMB(3111)).toBe("3.1 GB");
    expect(formatBytes(3_131_000_000)).toBe("3.1 GB");
    expect(formatMB(570)).toBe("570 MB");
  });
});
