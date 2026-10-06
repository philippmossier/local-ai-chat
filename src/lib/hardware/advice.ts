import { neighbour, type ModelSpec } from "../models/catalog";
import type { Option } from "./recommend";

export type SpeedAdvice =
  | { kind: "ok" }
  | { kind: "too-slow"; suggest: ModelSpec }
  | { kind: "room-to-grow"; suggest: ModelSpec };

/** Below this a chat feels broken; a reply of 200 tokens would take over 40 s. */
export const TOO_SLOW_TPS = 5;
/** Above this a bigger model is likely still pleasant. */
export const FAST_TPS = 30;
/** Speed measured over fewer tokens than this is noise (warm-up, first-token latency). */
export const MIN_TOKENS_FOR_ADVICE = 24;

/**
 * The hardware guess is a starting point. After the first real answer we know the actual speed, which
 * is better evidence than any vendor string, so use it to suggest moving one step down or up.
 */
export function adviseFromSpeed(
  tokensPerSecond: number,
  tokens: number,
  current: ModelSpec,
  options: Option[],
): SpeedAdvice {
  if (tokens < MIN_TOKENS_FOR_ADVICE) return { kind: "ok" };

  if (tokensPerSecond < TOO_SLOW_TPS) {
    const lighter = neighbour(current, -1);
    if (lighter) return { kind: "too-slow", suggest: lighter };
    return { kind: "ok" };
  }

  if (tokensPerSecond >= FAST_TPS) {
    const heavier = neighbour(current, 1);
    const fit = options.find((o) => o.model.id === heavier?.id)?.fit;
    if (heavier && (fit === "good" || fit === "recommended" || fit === "slow")) {
      return { kind: "room-to-grow", suggest: heavier };
    }
  }
  return { kind: "ok" };
}
