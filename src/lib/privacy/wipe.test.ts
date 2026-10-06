import { beforeEach, describe, expect, it, vi } from "vitest";
import { isMarkedComplete, markModelComplete } from "./wipe";

describe("model completion marker", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
  });

  it("is absent until a load finished, so a cancelled download does not count as cached", () => {
    expect(isMarkedComplete("org/model", "abc", "q4f16")).toBe(false);
    markModelComplete("org/model", "abc", "q4f16");
    expect(isMarkedComplete("org/model", "abc", "q4f16")).toBe(true);
  });

  it("is per weight format and revision", () => {
    markModelComplete("org/model", "abc", "q4f16");
    expect(isMarkedComplete("org/model", "abc", "q4")).toBe(false);
    expect(isMarkedComplete("org/model", "def", "q4f16")).toBe(false);
  });

  it("survives a corrupt stored value", () => {
    localStorage.setItem("local-ai-chat:complete-models", "{not json");
    expect(isMarkedComplete("org/model", "abc", "q4f16")).toBe(false);
    markModelComplete("org/model", "abc", "q4f16");
    expect(isMarkedComplete("org/model", "abc", "q4f16")).toBe(true);
  });
});
