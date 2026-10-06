import {
  CATALOG,
  TIER_ORDER,
  type Device,
  type Dtype,
  type ModelSpec,
} from "../models/catalog";
import { classify, type Classification } from "./classify";
import { COMFORTABLE_TPS, estimateTokensPerSecond, UNUSABLE_TPS } from "./estimate";
import type { Fit, HardwareClass, HardwareProfile } from "./types";

export interface Backend {
  device: Device;
  dtype: Dtype;
}

/** GPU when there is a usable one, else the CPU through WebAssembly. q4f16 only where f16 shaders exist. */
export function pickBackend(
  p: HardwareProfile,
  cls: HardwareClass = classify(p).class,
): Backend {
  const gpu = cls === "strong-gpu" || cls === "basic-gpu";
  if (gpu) return { device: "webgpu", dtype: p.gpu.shaderF16 ? "q4f16" : "q4" };
  return { device: "wasm", dtype: "q4" };
}

export interface Option {
  model: ModelSpec;
  fit: Fit;
  backend: Backend;
  downloadMB: number;
  /**
   * The browser reports less free storage than the download needs. Only a warning: privacy-oriented
   * browsers clamp this number (Brave reported 2 GB while holding 5 GB), so it must not block anything.
   */
  lowStorage: boolean;
  /** Estimated generation speed from the measured GPU speed. Undefined when it could not be measured. */
  estimatedTps?: number;
}

export interface Recommendation {
  classification: Classification;
  backend: Backend;
  options: Option[];
  /** The one-click choice. Undefined when nothing can run here. */
  recommended?: Option;
}

/** Which tier each hardware class should start with. Everything below is "good", above is "slow". */
const SWEET_SPOT: Record<HardwareClass, number> = {
  "strong-gpu": 2, // Gemma 4 E2B
  "basic-gpu": 1, // Qwen3 1.7B
  "cpu-only": 0, // Qwen3 0.6B
  unsupported: -1,
};

/** Never pre-select the largest model: it can exhaust memory on machines that look fast on paper. */
const MAX_AUTO_TIER = 2;

/** `cached` = ids of models already stored in the browser: they need no download, so no free space. */
export function recommend(
  p: HardwareProfile,
  cached: ReadonlySet<string> = new Set(),
): Recommendation {
  const classification = classify(p);
  const backend = pickBackend(p, classification.class);
  const bandwidth = backend.device === "webgpu" ? p.gpu.bandwidthGBs : undefined;
  if (bandwidth !== undefined && classification.class !== "unsupported") {
    return recommendFromMeasurement(p, classification, backend, bandwidth, cached);
  }
  const sweet = SWEET_SPOT[classification.class];
  const cap = classification.tierCap;

  const options: Option[] = CATALOG.map((model) => {
    const tier = TIER_ORDER.indexOf(model.tier);
    const downloadMB = cached.has(model.id) ? 0 : model.downloadMB[backend.dtype];
    let fit: Fit;
    if (classification.class === "unsupported") fit = "not-advised";
    else if (cap !== null && tier > cap) fit = "not-advised";
    else if (tier === Math.min(sweet, cap ?? sweet)) fit = "recommended";
    else if (tier < sweet) fit = "good";
    else if (tier === sweet + 1) fit = "slow";
    else fit = "not-advised";
    return { model, fit, backend, downloadMB, lowStorage: isLowStorage(p, downloadMB) };
  });

  // The sweet spot can be capped away (memory, mobile); keep a recommendation whenever one model is usable.
  let recommended = options.find((o) => o.fit === "recommended");
  if (!recommended && classification.class !== "unsupported") {
    recommended = [...options].reverse().find((o) => o.fit === "good");
    if (recommended) recommended = { ...recommended, fit: "recommended" };
  }
  const merged = options.map((o) =>
    o.model.id === recommended?.model.id ? recommended! : o,
  );
  return { classification, backend, options: merged, recommended };
}

/** With a measured GPU speed, fit is decided by the speed each model is expected to reach. */
function recommendFromMeasurement(
  p: HardwareProfile,
  classification: Classification,
  backend: Backend,
  bandwidth: number,
  cached: ReadonlySet<string>,
): Recommendation {
  const cap = classification.tierCap;
  const options: Option[] = CATALOG.map((model) => {
    const tier = TIER_ORDER.indexOf(model.tier);
    const downloadMB = cached.has(model.id) ? 0 : model.downloadMB[backend.dtype];
    const estimatedTps = estimateTokensPerSecond(model, backend.dtype, bandwidth);
    let fit: Fit;
    if (cap !== null && tier > cap) fit = "not-advised";
    else if (estimatedTps >= COMFORTABLE_TPS) fit = "good";
    else if (estimatedTps >= UNUSABLE_TPS) fit = "slow";
    else fit = "not-advised";
    return {
      model,
      fit,
      backend,
      downloadMB,
      estimatedTps,
      lowStorage: isLowStorage(p, downloadMB),
    };
  });

  // The strongest model that is comfortable, but never past MAX_AUTO_TIER; else the lightest that fits.
  const candidates = options.filter(
    (o) => o.fit === "good" && TIER_ORDER.indexOf(o.model.tier) <= MAX_AUTO_TIER,
  );
  const pickOption =
    candidates.at(-1) ??
    options.find((o) => o.fit === "slow") ??
    // Everything is "not advised" (a very slow GPU): still offer the lightest model that fits.
    options[0];
  const recommended = pickOption
    ? { ...pickOption, fit: "recommended" as const }
    : undefined;
  return {
    classification,
    backend,
    options: options.map((o) => (o.model.id === recommended?.model.id ? recommended : o)),
    recommended,
  };
}

const isLowStorage = (p: HardwareProfile, downloadMB: number) =>
  downloadMB > 0 && p.storageFreeMB !== undefined && p.storageFreeMB < downloadMB * 1.15;
