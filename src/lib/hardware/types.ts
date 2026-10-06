export type Platform =
  "mac-apple" | "mac-intel" | "windows" | "linux" | "android" | "ios" | "other";
export type Browser = "chrome" | "edge" | "safari" | "firefox" | "other";

/** What the browser will tell us about the machine. Most of it is deliberately coarse (privacy). */
export interface HardwareProfile {
  platform: Platform;
  browser: Browser;
  isMobile: boolean;
  /** HTTPS or localhost. Without it the browser exposes neither GPU access nor persistent storage. */
  secureContext: boolean;
  hasWorkers: boolean;
  hasWasm: boolean;
  gpu: {
    webgpu: boolean;
    vendor?: string;
    architecture?: string;
    description?: string;
    /** Half-precision shaders: needed for the smallest (q4f16) model files. */
    shaderF16: boolean;
    maxBufferMB?: number;
    /** A software renderer pretending to be a GPU. Useless for inference. */
    isFallbackAdapter: boolean;
    /** Measured GPU memory read speed in GB/s (see bandwidth.ts). Absent when the test could not run. */
    bandwidthGBs?: number;
  };
  cpuThreads: number;
  /** navigator.deviceMemory: Chromium only, rounded, and capped at 8 (so "8" means "8 or more"). */
  deviceMemoryGB?: number;
  crossOriginIsolated: boolean;
  /** Free space the browser is willing to give this site, if it says. */
  storageFreeMB?: number;
}

export type HardwareClass = "strong-gpu" | "basic-gpu" | "cpu-only" | "unsupported";

export type Fit = "recommended" | "good" | "slow" | "not-advised";
