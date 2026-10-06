import type { Backend } from "../hardware/recommend";
import type { ModelSpec } from "../models/catalog";
import type {
  ChatMessage,
  FromWorker,
  GenerationStats,
  ResourceRecord,
  ToWorker,
} from "./protocol";

export interface LoadHandlers {
  onProgress?: (loadedBytes: number, totalBytes: number) => void;
  onPhase?: (phase: "loading" | "warming") => void;
}

type Pending = {
  resolve: (value: never) => void;
  reject: (reason: Error) => void;
  handlers?: LoadHandlers & { onToken?: (text: string) => void };
};

/** Main-thread handle to the inference worker. One load or one generation at a time. */
export class EngineClient {
  private worker: Worker;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private resourceListeners = new Set<(entries: ResourceRecord[]) => void>();

  constructor() {
    this.worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (e: MessageEvent<FromWorker>) => this.handle(e.data);
    this.worker.onerror = (e) =>
      this.failAll(new Error(e.message || "The engine crashed."));
  }

  onResources(listener: (entries: ResourceRecord[]) => void) {
    this.resourceListeners.add(listener);
    return () => this.resourceListeners.delete(listener);
  }

  load(
    model: ModelSpec,
    backend: Backend,
    handlers: LoadHandlers = {},
  ): Promise<{ loadMs: number }> {
    return this.request(
      (id) => ({
        type: "load",
        id,
        repo: model.repo,
        revision: model.revision,
        family: model.family,
        backend,
      }),
      handlers,
    );
  }

  generate(
    messages: ChatMessage[],
    onToken: (text: string) => void,
    maxNewTokens = 1024,
  ): Promise<GenerationStats> {
    return this.request((id) => ({ type: "generate", id, messages, maxNewTokens }), {
      onToken,
    });
  }

  interrupt() {
    this.worker.postMessage({ type: "interrupt" } satisfies ToWorker);
  }

  dispose(): Promise<void> {
    return this.request((id) => ({ type: "dispose", id }));
  }

  terminate() {
    this.worker.terminate();
    this.failAll(new Error("Engine stopped."));
  }

  private request<T>(
    build: (id: number) => ToWorker,
    handlers?: Pending["handlers"],
  ): Promise<T> {
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: never) => void, reject, handlers });
      this.worker.postMessage(build(id));
    });
  }

  private handle(msg: FromWorker) {
    if (msg.type === "resources") {
      this.resourceListeners.forEach((l) => l(msg.entries));
      return;
    }
    const entry = this.pending.get(msg.id);
    if (!entry) return;
    switch (msg.type) {
      case "progress":
        entry.handlers?.onProgress?.(msg.loadedBytes, msg.totalBytes);
        break;
      case "status":
        entry.handlers?.onPhase?.(msg.phase);
        break;
      case "token":
        entry.handlers?.onToken?.(msg.text);
        break;
      case "loaded":
        this.settle(msg.id, entry, { loadMs: msg.loadMs });
        break;
      case "generated":
        this.settle(msg.id, entry, msg.stats);
        break;
      case "disposed":
        this.settle(msg.id, entry, undefined);
        break;
      case "error":
        this.pending.delete(msg.id);
        entry.reject(new Error(msg.message));
        break;
    }
  }

  private settle(id: number, entry: Pending, value: unknown) {
    this.pending.delete(id);
    entry.resolve(value as never);
  }

  private failAll(error: Error) {
    for (const [id, entry] of this.pending) {
      this.pending.delete(id);
      entry.reject(error);
    }
  }
}
