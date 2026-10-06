import { describe, expect, it } from "vitest";
import { getModel, REFERENCE_BANDWIDTH_GBS } from "../models/catalog";
import { adviseFromSpeed } from "./advice";
import { classify } from "./classify";
import { estimateTokensPerSecond } from "./estimate";
import { PROFILES } from "./fixtures";
import { pickBackend, recommend } from "./recommend";
import type { HardwareProfile } from "./types";

const pick = (p: HardwareProfile) => recommend(p).recommended?.model.id;
const fits = (p: HardwareProfile) =>
  Object.fromEntries(recommend(p).options.map((o) => [o.model.id, o.fit]));

describe("classify", () => {
  it.each([
    ["appleSiliconMac", "strong-gpu"],
    ["windowsRtx", "strong-gpu"],
    ["intelMacIntegrated", "basic-gpu"],
    ["windowsIntelLaptop", "basic-gpu"],
    ["lowMemoryChromebook", "basic-gpu"],
    ["iphone", "basic-gpu"],
    ["firefoxNoWebgpu", "cpu-only"],
    ["softwareRenderer", "cpu-only"],
    ["insecureHttp", "unsupported"],
  ] as const)("%s -> %s", (name, expected) => {
    expect(classify(PROFILES[name]).class).toBe(expected);
  });

  it("explains itself with reason keys", () => {
    expect(classify(PROFILES.appleSiliconMac).reasons).toContain("hw.appleSilicon");
    expect(classify(PROFILES.firefoxNoWebgpu).reasons).toContain("hw.noWebgpu");
    expect(classify(PROFILES.softwareRenderer).reasons).toContain("hw.softwareGpu");
    expect(classify(PROFILES.iphone).reasons).toContain("hw.mobile");
  });

  it("treats a missing WebAssembly or Worker as unsupported", () => {
    expect(classify({ ...PROFILES.appleSiliconMac, hasWasm: false }).class).toBe(
      "unsupported",
    );
    expect(classify({ ...PROFILES.appleSiliconMac, hasWorkers: false }).class).toBe(
      "unsupported",
    );
  });

  it("only trusts AMD as strong with half-precision shaders and big buffers", () => {
    const amd = (shaderF16: boolean, maxBufferMB: number) => ({
      ...PROFILES.windowsRtx,
      gpu: { ...PROFILES.windowsRtx.gpu, vendor: "amd", shaderF16, maxBufferMB },
    });
    expect(classify(amd(true, 4096)).class).toBe("strong-gpu");
    expect(classify(amd(false, 4096)).class).toBe("basic-gpu");
    expect(classify(amd(true, 512)).class).toBe("basic-gpu");
  });
});

describe("recommend", () => {
  it.each([
    ["appleSiliconMac", "gemma4-e2b"],
    ["windowsRtx", "gemma4-e2b"],
    ["intelMacIntegrated", "qwen3-1.7b"],
    ["windowsIntelLaptop", "qwen3-1.7b"],
    ["firefoxNoWebgpu", "qwen3-0.6b"],
    ["softwareRenderer", "qwen3-0.6b"],
    ["lowMemoryChromebook", "qwen3-0.6b"],
    ["iphone", "qwen3-0.6b"],
  ] as const)("%s starts with %s", (name, expected) => {
    expect(pick(PROFILES[name])).toBe(expected);
  });

  it("recommends nothing on an unsupported browser", () => {
    expect(pick(PROFILES.insecureHttp)).toBeUndefined();
    expect(
      Object.values(fits(PROFILES.insecureHttp)).every((f) => f === "not-advised"),
    ).toBe(true);
  });

  it("offers the next size up as 'slow' and hides what the machine cannot carry", () => {
    expect(fits(PROFILES.appleSiliconMac)).toEqual({
      "qwen3-0.6b": "good",
      "qwen3-1.7b": "good",
      "gemma4-e2b": "recommended",
      "gemma4-e4b": "slow",
    });
    expect(fits(PROFILES.windowsIntelLaptop)).toEqual({
      "qwen3-0.6b": "good",
      "qwen3-1.7b": "recommended",
      "gemma4-e2b": "slow",
      "gemma4-e4b": "not-advised",
    });
    expect(fits(PROFILES.firefoxNoWebgpu)["gemma4-e2b"]).toBe("not-advised");
  });

  it("treats low reported storage as a warning, never as a blocker", () => {
    const tight = { ...PROFILES.appleSiliconMac, storageFreeMB: 2000 };
    const r = recommend(tight);
    expect(r.recommended?.model.id).toBe("gemma4-e2b");
    expect(r.recommended?.lowStorage).toBe(true);
    expect(r.options.find((o) => o.model.id === "qwen3-0.6b")?.lowStorage).toBe(false);
  });

  it("reports the download that matches the weight format that will be used", () => {
    const apple = recommend(PROFILES.appleSiliconMac).recommended!;
    expect(apple.backend).toEqual({ device: "webgpu", dtype: "q4f16" });
    expect(apple.downloadMB).toBe(3111);
    const intel = recommend(PROFILES.intelMacIntegrated).recommended!;
    expect(intel.backend).toEqual({ device: "webgpu", dtype: "q4" }); // no f16 shaders
    expect(intel.downloadMB).toBe(2147);
    const cpu = recommend(PROFILES.firefoxNoWebgpu).recommended!;
    expect(cpu.backend).toEqual({ device: "wasm", dtype: "q4" });
  });
});

describe("pickBackend", () => {
  it("uses the GPU only when a real one is present", () => {
    expect(pickBackend(PROFILES.softwareRenderer).device).toBe("wasm");
    expect(pickBackend(PROFILES.windowsRtx).device).toBe("webgpu");
  });
});

describe("adviseFromSpeed", () => {
  const options = recommend(PROFILES.appleSiliconMac).options;
  const e2b = getModel("gemma4-e2b")!;

  it("ignores speed measured on a short reply", () => {
    expect(adviseFromSpeed(1, 10, e2b, options)).toEqual({ kind: "ok" });
  });
  it("suggests the next lighter model when it is too slow to chat", () => {
    expect(adviseFromSpeed(3, 80, e2b, options)).toEqual({
      kind: "too-slow",
      suggest: getModel("qwen3-1.7b"),
    });
  });
  it("has nowhere to go below the lightest model", () => {
    expect(adviseFromSpeed(1, 80, getModel("qwen3-0.6b")!, options)).toEqual({
      kind: "ok",
    });
  });
  it("suggests growing when the machine is clearly fast", () => {
    expect(adviseFromSpeed(45, 80, e2b, options)).toEqual({
      kind: "room-to-grow",
      suggest: getModel("gemma4-e4b"),
    });
  });
  it("does not suggest a model the hardware cannot carry", () => {
    const weak = recommend(PROFILES.windowsIntelLaptop).options;
    expect(adviseFromSpeed(45, 80, getModel("gemma4-e2b")!, weak)).toEqual({
      kind: "ok",
    });
  });
  it("stays quiet in the comfortable middle", () => {
    expect(adviseFromSpeed(15, 80, e2b, options)).toEqual({ kind: "ok" });
  });
});

describe("recommend with a measured GPU speed", () => {
  it("does not need to know the vendor: a fast unnamed GPU gets a strong model", () => {
    const r = recommend(PROFILES.hiddenVendorFastGpu);
    expect(r.classification.class).toBe("strong-gpu");
    expect(r.classification.reasons[0]).toBe("hw.speedFast");
    expect(r.recommended?.model.id).toBe("gemma4-e2b");
    expect(r.recommended?.estimatedTps).toBe(34.7);
  });

  it("recommends the strongest model that stays comfortable on a middling GPU", () => {
    const r = recommend({
      ...PROFILES.hiddenVendorFastGpu,
      gpu: {
        ...PROFILES.hiddenVendorFastGpu.gpu,
        bandwidthGBs: REFERENCE_BANDWIDTH_GBS / 3,
      },
    });
    // a third of the reference bandwidth: E2B 11.6 and 1.7B 6.0 tok/s (slow), 0.6B 24.4 tok/s (good)
    expect(r.recommended?.model.id).toBe("qwen3-0.6b");
    expect(fitsOf(r)["qwen3-1.7b"]).toBe("slow");
  });

  it("puts an integrated GPU on the lightest model and flags the rest as heavy", () => {
    const r = recommend(PROFILES.integratedGpuMeasured);
    expect(r.classification.class).toBe("basic-gpu");
    expect(r.recommended?.model.id).toBe("qwen3-0.6b");
    expect(fitsOf(r)).toMatchObject({
      "qwen3-1.7b": "not-advised",
      "gemma4-e2b": "not-advised",
    });
  });

  it("never pre-selects the largest model, however fast the GPU", () => {
    const r = recommend(PROFILES.veryFastGpuMeasured);
    expect(r.recommended?.model.id).toBe("gemma4-e2b");
    expect(fitsOf(r)["gemma4-e4b"]).toBe("good"); // available, just not pre-selected
  });

  it("still offers the lightest model on a very weak GPU", () => {
    expect(recommend(PROFILES.veryWeakGpuMeasured).recommended?.model.id).toBe(
      "qwen3-0.6b",
    );
  });

  it("counts cached models as needing no download and no free space", () => {
    const tight = { ...PROFILES.hiddenVendorFastGpu, storageFreeMB: 2000 };
    expect(recommend(tight).recommended?.lowStorage).toBe(true);
    const withCached = recommend(tight, new Set(["gemma4-e2b"]));
    expect(withCached.recommended?.model.id).toBe("gemma4-e2b");
    expect(withCached.recommended?.downloadMB).toBe(0);
    expect(withCached.recommended?.lowStorage).toBe(false);
  });

  it("ignores the speed test on the CPU path", () => {
    const cpu = {
      ...PROFILES.firefoxNoWebgpu,
      gpu: { ...PROFILES.firefoxNoWebgpu.gpu, bandwidthGBs: 500 },
    };
    expect(recommend(cpu).recommended?.estimatedTps).toBeUndefined();
  });
});

describe("estimateTokensPerSecond", () => {
  const model = (id: string) => getModel(id)!;

  it("returns the measured speed at the reference bandwidth", () => {
    expect(
      estimateTokensPerSecond(model("qwen3-0.6b"), "q4f16", REFERENCE_BANDWIDTH_GBS),
    ).toBe(73.3);
  });
  it("scales linearly with bandwidth", () => {
    expect(
      estimateTokensPerSecond(model("gemma4-e2b"), "q4f16", REFERENCE_BANDWIDTH_GBS / 2),
    ).toBe(17.4);
  });
  it("is slower for files that need more bytes read (no half-precision shaders)", () => {
    const q4f16 = estimateTokensPerSecond(
      model("qwen3-0.6b"),
      "q4f16",
      REFERENCE_BANDWIDTH_GBS,
    );
    const q4 = estimateTokensPerSecond(
      model("qwen3-0.6b"),
      "q4",
      REFERENCE_BANDWIDTH_GBS,
    );
    expect(q4).toBeLessThan(q4f16);
  });
});

function fitsOf(r: ReturnType<typeof recommend>) {
  return Object.fromEntries(r.options.map((o) => [o.model.id, o.fit]));
}
