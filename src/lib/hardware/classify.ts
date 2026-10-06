import type { HardwareClass, HardwareProfile } from "./types";

export type ReasonId =
  | "hw.appleSilicon"
  | "hw.basicGpu"
  | "hw.dedicatedGpu"
  | "hw.insecure"
  | "hw.intelGpu"
  | "hw.lowMemory"
  | "hw.mobile"
  | "hw.noWasm"
  | "hw.noWebgpu"
  | "hw.softwareGpu"
  | "hw.speedFast"
  | "hw.speedMedium"
  | "hw.speedSlow";

export interface Classification {
  class: HardwareClass;
  /** Why the machine was classified this way, most important first. Shown through `reasonText`. */
  reasons: ReasonId[];
  /** Highest model tier index (0-3) worth offering, from memory and device type. null = no cap. */
  tierCap: number | null;
}

const STRONG_VENDORS = new Set(["apple", "nvidia"]);

/** Measured memory read speed at which a GPU counts as "strong" (roughly Apple M-series and up). */
export const STRONG_BANDWIDTH_GBS = 40;
/** Below this, even small models are slow. */
export const WEAK_BANDWIDTH_GBS = 15;

/**
 * Sorts a machine into one of four buckets. These are heuristics on purpose: the browser hides exact
 * hardware, so the result is a starting point that the first reply's measured speed can correct
 * (see advice.ts).
 */
export function classify(p: HardwareProfile): Classification {
  const reasons: ReasonId[] = [];

  if (!p.hasWasm || !p.hasWorkers) {
    return { class: "unsupported", reasons: ["hw.noWasm"], tierCap: 0 };
  }
  if (!p.secureContext) {
    return { class: "unsupported", reasons: ["hw.insecure"], tierCap: 0 };
  }

  let tierCap: number | null = null;
  const lowMemory = p.deviceMemoryGB !== undefined && p.deviceMemoryGB <= 4;
  if (lowMemory) {
    tierCap = 0;
    reasons.push("hw.lowMemory");
  }
  if (p.isMobile) {
    tierCap = 0;
    reasons.push("hw.mobile");
  }

  const hasGpu = p.gpu.webgpu && !p.gpu.isFallbackAdapter;
  if (!hasGpu) {
    reasons.push(p.gpu.webgpu ? "hw.softwareGpu" : "hw.noWebgpu");
    return {
      class: "cpu-only",
      reasons,
      tierCap: tierCap === null ? 1 : Math.min(tierCap, 1),
    };
  }

  const vendor = (p.gpu.vendor ?? "").toLowerCase();
  const bigBuffers = (p.gpu.maxBufferMB ?? 0) >= 2048;
  const vendorStrong =
    STRONG_VENDORS.has(vendor) || (vendor === "amd" && p.gpu.shaderF16 && bigBuffers);

  // A measurement beats a name: browsers often hide the vendor, and a name says little about speed.
  const bw = p.gpu.bandwidthGBs;
  const strong = bw !== undefined ? bw >= STRONG_BANDWIDTH_GBS : vendorStrong;

  if (bw !== undefined) {
    reasons.unshift(
      bw >= STRONG_BANDWIDTH_GBS
        ? "hw.speedFast"
        : bw >= WEAK_BANDWIDTH_GBS
          ? "hw.speedMedium"
          : "hw.speedSlow",
    );
  } else if (strong) {
    reasons.unshift(vendor === "apple" ? "hw.appleSilicon" : "hw.dedicatedGpu");
  } else {
    reasons.unshift(vendor === "intel" ? "hw.intelGpu" : "hw.basicGpu");
  }

  if (strong && !p.isMobile && !lowMemory) {
    return { class: "strong-gpu", reasons, tierCap };
  }

  // Integrated or slow graphics share system memory: keep the largest models out of reach.
  tierCap = tierCap === null ? 2 : Math.min(tierCap, 2);
  return { class: "basic-gpu", reasons, tierCap };
}
