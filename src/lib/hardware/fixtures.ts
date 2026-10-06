import { REFERENCE_BANDWIDTH_GBS } from "../models/catalog";
import type { HardwareProfile } from "./types";

const base: HardwareProfile = {
  platform: "windows",
  browser: "chrome",
  isMobile: false,
  secureContext: true,
  hasWorkers: true,
  hasWasm: true,
  gpu: { webgpu: false, shaderF16: false, isFallbackAdapter: false },
  cpuThreads: 8,
  crossOriginIsolated: false,
  deviceMemoryGB: 8,
};

const make = (
  over: Omit<Partial<HardwareProfile>, "gpu"> & { gpu?: Partial<HardwareProfile["gpu"]> },
): HardwareProfile => ({
  ...base,
  ...over,
  gpu: { ...base.gpu, ...over.gpu },
});

/** Representative machines, used by the tests and by the "try a different device" debug switch. */
export const PROFILES = {
  appleSiliconMac: make({
    platform: "mac-apple",
    cpuThreads: 10,
    gpu: {
      webgpu: true,
      vendor: "apple",
      architecture: "metal-3",
      shaderF16: true,
      maxBufferMB: 4096,
    },
  }),
  intelMacIntegrated: make({
    platform: "mac-intel",
    cpuThreads: 8,
    gpu: {
      webgpu: true,
      vendor: "intel",
      architecture: "gen-9",
      shaderF16: false,
      maxBufferMB: 2048,
    },
  }),
  windowsRtx: make({
    cpuThreads: 16,
    gpu: {
      webgpu: true,
      vendor: "nvidia",
      architecture: "ampere",
      shaderF16: true,
      maxBufferMB: 4096,
    },
  }),
  windowsIntelLaptop: make({
    cpuThreads: 8,
    gpu: {
      webgpu: true,
      vendor: "intel",
      architecture: "xe-lpg",
      shaderF16: true,
      maxBufferMB: 2048,
    },
  }),
  firefoxNoWebgpu: make({ browser: "firefox", deviceMemoryGB: undefined, cpuThreads: 8 }),
  lowMemoryChromebook: make({
    platform: "linux",
    deviceMemoryGB: 4,
    cpuThreads: 4,
    gpu: { webgpu: true, vendor: "intel", shaderF16: false, maxBufferMB: 1024 },
  }),
  iphone: make({
    platform: "ios",
    browser: "safari",
    isMobile: true,
    deviceMemoryGB: undefined,
    cpuThreads: 6,
    gpu: { webgpu: true, vendor: "apple", shaderF16: true, maxBufferMB: 1024 },
  }),
  softwareRenderer: make({
    platform: "linux",
    gpu: {
      webgpu: true,
      vendor: "google",
      architecture: "swiftshader",
      shaderF16: false,
      isFallbackAdapter: true,
    },
  }),
  insecureHttp: make({ secureContext: false }),
  /** Brave on an Apple chip: the browser reports no vendor, but the speed test shows a fast GPU. */
  hiddenVendorFastGpu: make({
    platform: "mac-apple",
    gpu: {
      webgpu: true,
      shaderF16: true,
      maxBufferMB: 4096,
      bandwidthGBs: REFERENCE_BANDWIDTH_GBS,
    },
  }),
  integratedGpuMeasured: make({
    gpu: {
      webgpu: true,
      vendor: "intel",
      shaderF16: true,
      maxBufferMB: 2048,
      bandwidthGBs: 25,
    },
  }),
  veryFastGpuMeasured: make({
    gpu: {
      webgpu: true,
      vendor: "nvidia",
      shaderF16: true,
      maxBufferMB: 4096,
      bandwidthGBs: 450,
    },
  }),
  veryWeakGpuMeasured: make({
    gpu: {
      webgpu: true,
      vendor: "intel",
      shaderF16: false,
      maxBufferMB: 1024,
      bandwidthGBs: 10,
    },
  }),
} satisfies Record<string, HardwareProfile>;
