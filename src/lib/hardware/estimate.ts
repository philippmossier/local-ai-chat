import { REFERENCE_BANDWIDTH_GBS, type Dtype, type ModelSpec } from "../models/catalog";

/**
 * Expected generation speed in tokens per second on a GPU with the given measured memory bandwidth.
 *
 * Each model has a speed that was actually measured on a reference machine. Other machines are scaled
 * linearly by bandwidth, and a q4 file (no half-precision shaders) by how much more it has to read.
 * Crude on purpose: the measured speed of the first real answer corrects it (advice.ts).
 *
 * An earlier version derived speed from model size alone. It predicted Qwen3 1.7B to be as fast as
 * Gemma 4 E2B; in practice it was half as fast, so model size is not a sufficient predictor.
 */
export function estimateTokensPerSecond(
  model: ModelSpec,
  dtype: Dtype,
  bandwidthGBs: number,
): number {
  const bytesRatio = model.activeMB.q4f16 / model.activeMB[dtype];
  const tps = model.referenceTps * (bandwidthGBs / REFERENCE_BANDWIDTH_GBS) * bytesRatio;
  return Math.round(tps * 10) / 10;
}

/** At or above this a chat feels responsive. */
export const COMFORTABLE_TPS = 15;
/** Below this a chat feels broken. */
export const UNUSABLE_TPS = 6;
