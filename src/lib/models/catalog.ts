/**
 * The models the app can run, smallest first.
 *
 * Download sizes are what a text-only chat actually fetches (decoder + embeddings, no vision or
 * audio encoders), summed from the file sizes of the Hugging Face repos on 2026-10-05.
 * Reference speeds were measured on one Mac with an Apple GPU on the same day (see README).
 * All four are Apache-2.0, which matters to organisations that have to vet licences.
 */

export type Tier = "light" | "balanced" | "strong" | "best";
export type Dtype = "q4f16" | "q4";
export type Device = "webgpu" | "wasm";

export interface ModelSpec {
  id: string;
  tier: Tier;
  label: string;
  maker: string;
  /** Hugging Face repo with the ONNX export. */
  repo: string;
  /** Which Transformers.js model family: Gemma 4 is a multimodal class that must be loaded text-only. */
  family: "qwen3" | "gemma4";
  /** Parameter count as marketed. Gemma 4 E2B and E4B are 2.3B and 4.5B *effective* parameters (5.1B and 8B with embeddings). */
  params: string;
  license: "Apache-2.0";
  languages: string;
  /** Download in megabytes by weight format. q4f16 needs a GPU with half-precision shaders. */
  downloadMB: Record<Dtype, number>;
  /**
   * Megabytes of weights the GPU reads for every generated token (the decoder; Gemma's large
   * per-layer embedding table is only looked up, not streamed). Used to estimate speed.
   */
  activeMB: Record<Dtype, number>;
  /**
   * Measured generation speed (tokens/s, q4f16 on WebGPU) with the GPU at REFERENCE_BANDWIDTH_GBS.
   * `measured: false` means extrapolated from a measured sibling, not observed.
   */
  referenceTps: number;
  measured: boolean;
  /** Pinned commit of the Hugging Face repo, so a later change to `main` cannot alter what loads. */
  revision: string;
}

/** GPU memory bandwidth (GB/s, measured by bandwidth.ts) of the machine the reference speeds come from. */
export const REFERENCE_BANDWIDTH_GBS = 310;

export const CATALOG: ModelSpec[] = [
  {
    id: "qwen3-0.6b",
    tier: "light",
    label: "Qwen3 0.6B",
    maker: "Alibaba",
    repo: "onnx-community/Qwen3-0.6B-ONNX",
    family: "qwen3",
    params: "0.6B",
    license: "Apache-2.0",
    languages: "119",
    downloadMB: { q4f16: 570, q4: 919 },
    activeMB: { q4f16: 570, q4: 919 },
    referenceTps: 73.3,
    measured: true,
    revision: "da1453100cf3ff33ef56d17983fc7a8648706db6",
  },
  {
    id: "qwen3-1.7b",
    tier: "balanced",
    label: "Qwen3 1.7B",
    maker: "Alibaba",
    repo: "onnx-community/Qwen3-1.7B-ONNX",
    family: "qwen3",
    params: "1.7B",
    license: "Apache-2.0",
    languages: "119",
    downloadMB: { q4f16: 1426, q4: 2147 },
    activeMB: { q4f16: 1426, q4: 2147 },
    referenceTps: 18.1,
    measured: true,
    revision: "cc6a06a21d614e9b8e92a6adfab1074d4e7d2438",
  },
  {
    id: "gemma4-e2b",
    tier: "strong",
    label: "Gemma 4 E2B",
    maker: "Google",
    repo: "onnx-community/gemma-4-E2B-it-ONNX",
    family: "gemma4",
    params: "2.3B",
    license: "Apache-2.0",
    languages: "140",
    downloadMB: { q4f16: 3111, q4: 3628 },
    activeMB: { q4f16: 1520, q4: 1865 },
    referenceTps: 34.7,
    measured: true,
    revision: "9f4bef82ea6e296bc69f8a2f5939f73af81b07a6",
  },
  {
    id: "gemma4-e4b",
    tier: "best",
    label: "Gemma 4 E4B",
    maker: "Google",
    repo: "onnx-community/gemma-4-E4B-it-ONNX",
    family: "gemma4",
    params: "4.5B",
    license: "Apache-2.0",
    languages: "140",
    downloadMB: { q4f16: 4905, q4: 5617 },
    activeMB: { q4f16: 2888, q4: 3381 },
    referenceTps: 23.1,
    measured: true,
    revision: "843f250f23bc91754def1e0f0db390dacd1e6b05",
  },
];

export const TIER_ORDER: Tier[] = ["light", "balanced", "strong", "best"];

export const getModel = (id: string) => CATALOG.find((m) => m.id === id);

export function neighbour(model: ModelSpec, direction: -1 | 1): ModelSpec | undefined {
  return CATALOG[CATALOG.findIndex((m) => m.id === model.id) + direction];
}
