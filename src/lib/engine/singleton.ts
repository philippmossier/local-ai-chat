import { EngineClient } from "./client";
import type { ResourceRecord } from "./protocol";

/**
 * One engine (one worker) for the whole page. Cancelling a download terminates the worker, which is
 * the only way to stop a running fetch inside the model loader, so the engine can be replaced.
 * Resource listeners live here so they survive that replacement.
 */
let engine: EngineClient | null = null;
const listeners = new Set<(entries: ResourceRecord[]) => void>();

export function getEngine(): EngineClient {
  if (!engine) {
    engine = new EngineClient();
    engine.onResources((entries) => listeners.forEach((l) => l(entries)));
  }
  return engine;
}

export function resetEngine() {
  engine?.terminate();
  engine = null;
}

export function subscribeResources(listener: (entries: ResourceRecord[]) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
