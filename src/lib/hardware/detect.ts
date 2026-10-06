import { measureGpuBandwidthGBs } from "./bandwidth";
import type { Browser, HardwareProfile, Platform } from "./types";

// WebGPU and a few Navigator extras are not in the standard DOM typings; describe only what we read.
interface GpuAdapterInfo {
  vendor?: string;
  architecture?: string;
  device?: string;
  description?: string;
  isFallbackAdapter?: boolean;
}
interface GpuAdapter {
  info?: GpuAdapterInfo;
  features: { has(name: string): boolean };
  limits: { maxBufferSize?: number };
  isFallbackAdapter?: boolean;
  requestAdapterInfo?: () => Promise<GpuAdapterInfo>;
}
interface UserAgentData {
  platform?: string;
  mobile?: boolean;
  getHighEntropyValues?: (hints: string[]) => Promise<{ architecture?: string }>;
}
type NavigatorExtras = Navigator & {
  gpu?: { requestAdapter(options?: object): Promise<GpuAdapter | null> };
  deviceMemory?: number;
  userAgentData?: UserAgentData;
};

export function detectBrowser(ua: string): Browser {
  if (/Edg\//.test(ua)) return "edge";
  if (/Firefox\//.test(ua)) return "firefox";
  if (/Chrome\/|Chromium\/|CriOS\//.test(ua)) return "chrome";
  if (/Safari\//.test(ua)) return "safari";
  return "other";
}

export function detectPlatform(
  ua: string,
  uaPlatform: string | undefined,
  arch: string | undefined,
  gpuVendor?: string,
): Platform {
  const p = (uaPlatform ?? "").toLowerCase();
  if (/android/i.test(ua) || p === "android") return "android";
  if (/iPhone|iPad|iPod/.test(ua) || p === "ios") return "ios";
  if (/Mac/.test(ua) || p === "macos") {
    if (arch === "arm") return "mac-apple";
    if (arch === "x86") return "mac-intel";
    // Safari and Firefox hide the CPU. The GPU vendor gives it away.
    if (gpuVendor === "apple") return "mac-apple";
    if (gpuVendor === "intel" || gpuVendor === "amd") return "mac-intel";
    return "other";
  }
  if (/Win/.test(ua) || p === "windows") return "windows";
  if (/Linux|X11|CrOS/.test(ua) || p === "linux" || p === "chrome os") return "linux";
  return "other";
}

/** Everything here stays in the browser. Nothing is sent anywhere. */
export async function detectHardware(): Promise<HardwareProfile> {
  const nav = navigator as NavigatorExtras;
  const ua = nav.userAgent;

  const gpu: HardwareProfile["gpu"] = {
    webgpu: false,
    shaderF16: false,
    isFallbackAdapter: false,
  };
  if (nav.gpu) {
    try {
      const adapter = await nav.gpu.requestAdapter({
        powerPreference: "high-performance",
      });
      if (adapter) {
        const info = adapter.info ?? (await adapter.requestAdapterInfo?.()) ?? {};
        gpu.webgpu = true;
        gpu.vendor = info.vendor?.toLowerCase() || undefined;
        gpu.architecture = info.architecture || undefined;
        gpu.description = info.description || info.device || undefined;
        gpu.shaderF16 = adapter.features.has("shader-f16");
        gpu.maxBufferMB = adapter.limits.maxBufferSize
          ? Math.round(adapter.limits.maxBufferSize / 1024 / 1024)
          : undefined;
        gpu.isFallbackAdapter = Boolean(
          info.isFallbackAdapter ?? adapter.isFallbackAdapter,
        );
      }
    } catch {
      // WebGPU exists but is blocked or crashed: treat as unavailable.
    }
  }

  if (gpu.webgpu && !gpu.isFallbackAdapter) {
    gpu.bandwidthGBs = (await measureGpuBandwidthGBs()) ?? undefined;
  }

  let arch: string | undefined;
  try {
    arch = (await nav.userAgentData?.getHighEntropyValues?.(["architecture"]))
      ?.architecture;
  } catch {
    // not available or denied
  }

  let storageFreeMB: number | undefined;
  try {
    const { quota, usage } = (await nav.storage?.estimate?.()) ?? {};
    if (quota) storageFreeMB = Math.round((quota - (usage ?? 0)) / 1e6); // decimal MB, like the catalog
  } catch {
    // not available
  }

  return {
    platform: detectPlatform(ua, nav.userAgentData?.platform, arch, gpu.vendor),
    browser: detectBrowser(ua),
    isMobile:
      Boolean(nav.userAgentData?.mobile) || /Android|iPhone|iPad|iPod|Mobile/.test(ua),
    secureContext: window.isSecureContext,
    hasWorkers: typeof Worker !== "undefined",
    hasWasm: typeof WebAssembly === "object",
    gpu,
    cpuThreads: nav.hardwareConcurrency || 4,
    deviceMemoryGB: nav.deviceMemory,
    crossOriginIsolated: window.crossOriginIsolated,
    storageFreeMB,
  };
}
