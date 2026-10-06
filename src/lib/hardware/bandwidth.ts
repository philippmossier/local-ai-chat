/**
 * Measures how fast the GPU can read memory, in GB/s.
 *
 * Why this and not the vendor name: generating text is memory-bound. For every token the GPU reads
 * (almost) all the model's weights once, so tokens per second is roughly bandwidth divided by model
 * size. And browsers increasingly hide the vendor and architecture (Brave, Firefox, privacy settings),
 * so the name is often missing. A half-second measurement gives a number that does not depend on it.
 */

// Minimal WebGPU surface so this file does not need @webgpu/types.
interface GpuBuffer {
  destroy(): void;
}
interface GpuDevice {
  createBuffer(d: { size: number; usage: number }): GpuBuffer;
  createShaderModule(d: { code: string }): unknown;
  createComputePipeline(d: unknown): { getBindGroupLayout(i: number): unknown };
  createBindGroup(d: unknown): unknown;
  createCommandEncoder(): {
    beginComputePass(): {
      setPipeline(p: unknown): void;
      setBindGroup(i: number, g: unknown): void;
      dispatchWorkgroups(x: number): void;
      end(): void;
    };
    finish(): unknown;
  };
  queue: { submit(c: unknown[]): void; onSubmittedWorkDone(): Promise<void> };
  destroy(): void;
}
interface GpuAdapterLike {
  requestDevice(d?: unknown): Promise<GpuDevice>;
  limits?: { maxStorageBufferBindingSize?: number; maxBufferSize?: number };
}

const STORAGE = 0x80; // GPUBufferUsage.STORAGE

const READ_SHADER = /* wgsl */ `
@group(0) @binding(0) var<storage, read> src: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read_write> dst: array<vec4<f32>>;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) id: vec3<u32>, @builtin(num_workgroups) groups: vec3<u32>) {
  let threads = groups.x * 256u;
  var acc = vec4<f32>(0.0);
  // 16 strided reads per thread: neighbouring threads read neighbouring addresses (coalesced).
  for (var k = 0u; k < 16u; k = k + 1u) {
    acc = acc + src[id.x + k * threads];
  }
  dst[id.x] = acc;
}
`;

// Fill the buffer with non-zero data so the GPU cannot shortcut reads of untouched (compressed) memory.
const FILL_SHADER = /* wgsl */ `
@group(0) @binding(0) var<storage, read_write> buf: array<vec4<f32>>;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) id: vec3<u32>, @builtin(num_workgroups) groups: vec3<u32>) {
  let threads = groups.x * 256u;
  for (var k = 0u; k < 16u; k = k + 1u) {
    let i = id.x + k * threads;
    let h = f32((i * 2654435761u) % 65521u) / 65521.0;
    buf[i] = vec4<f32>(h, h + 1.0, h + 2.0, h + 3.0);
  }
}
`;

// Larger than the system-level cache of current chips (tens of MB), so reads really hit memory.
const PREFERRED_BYTES = 256 * 1024 * 1024;
const FALLBACK_BYTES = 64 * 1024 * 1024;
/** GPUs idle in a low-power state; sustained work for this long brings the clocks up. */
const RAMP_UP_MS = 250;
const RAMP_BATCH = 8;
const TRIALS = 5;
/** Each timed trial should last about this long, so timer resolution and launch overhead do not matter. */
const TRIAL_TARGET_MS = 40;

export async function measureGpuBandwidthGBs(): Promise<number | null> {
  const gpu = (
    navigator as Navigator & {
      gpu?: { requestAdapter(): Promise<GpuAdapterLike | null> };
    }
  ).gpu;
  if (!gpu) return null;
  let device: GpuDevice | null = null;
  try {
    const adapter = await gpu.requestAdapter();
    if (!adapter) return null;

    // Ask for the bigger binding when the hardware allows it; otherwise measure with the default size.
    const limit = Math.min(
      adapter.limits?.maxStorageBufferBindingSize ?? 0,
      adapter.limits?.maxBufferSize ?? 0,
    );
    const bytes = limit >= PREFERRED_BYTES ? PREFERRED_BYTES : FALLBACK_BYTES;
    device = await adapter.requestDevice(
      bytes === PREFERRED_BYTES
        ? { requiredLimits: { maxStorageBufferBindingSize: bytes, maxBufferSize: bytes } }
        : undefined,
    );

    const elements = bytes / 16; // vec4<f32>
    const threads = elements / 16;
    const src = device.createBuffer({ size: bytes, usage: STORAGE });
    const dst = device.createBuffer({ size: threads * 16, usage: STORAGE });

    const fill = device.createComputePipeline({
      layout: "auto",
      compute: {
        module: device.createShaderModule({ code: FILL_SHADER }),
        entryPoint: "main",
      },
    });
    const read = device.createComputePipeline({
      layout: "auto",
      compute: {
        module: device.createShaderModule({ code: READ_SHADER }),
        entryPoint: "main",
      },
    });
    const fillGroup = device.createBindGroup({
      layout: fill.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: src } }],
    });
    const readGroup = device.createBindGroup({
      layout: read.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: src } },
        { binding: 1, resource: { buffer: dst } },
      ],
    });

    const dispatch = (pipeline: unknown, group: unknown, times: number) => {
      const encoder = device!.createCommandEncoder();
      const pass = encoder.beginComputePass();
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, group);
      for (let i = 0; i < times; i++) pass.dispatchWorkgroups(threads / 256);
      pass.end();
      device!.queue.submit([encoder.finish()]);
    };

    dispatch(fill, fillGroup, 1);

    // Ramp-up. A cold GPU reads half as fast as a warm one (150 vs 310 GB/s on the development
    // machine), and inference itself runs warm, so the number has to be a warm one.
    const rampEnd = performance.now() + RAMP_UP_MS;
    let msPerDispatch = 1;
    while (performance.now() < rampEnd) {
      const t = performance.now();
      dispatch(read, readGroup, RAMP_BATCH);
      await device.queue.onSubmittedWorkDone();
      msPerDispatch = Math.max(0.01, (performance.now() - t) / RAMP_BATCH);
    }

    // Several timed trials, median taken: other GPU work still makes single runs swing.
    const repeats = Math.min(
      300,
      Math.max(4, Math.round(TRIAL_TARGET_MS / msPerDispatch)),
    );
    const trials: number[] = [];
    for (let t = 0; t < TRIALS; t++) {
      const started = performance.now();
      dispatch(read, readGroup, repeats);
      await device.queue.onSubmittedWorkDone();
      const seconds = (performance.now() - started) / 1000;
      trials.push((bytes * repeats) / seconds / 1e9);
    }
    trials.sort((a, b) => a - b);
    const gbs = trials[Math.floor(trials.length / 2)]!;

    src.destroy();
    dst.destroy();
    return Number.isFinite(gbs) && gbs > 0 ? Math.round(gbs * 10) / 10 : null;
  } catch {
    return null;
  } finally {
    device?.destroy();
  }
}
