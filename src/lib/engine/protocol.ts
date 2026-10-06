import type { Backend } from "../hardware/recommend";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ResourceRecord {
  /** Full URL of the request. */
  url: string;
  host: string;
  /** Bytes over the network (0 for cache hits). */
  bytes: number;
  /** Milliseconds since the page's time origin, comparable across the page and its worker. */
  startedAt: number;
  source: "page" | "worker";
}

export interface GenerationStats {
  tokens: number;
  tokensPerSecond: number;
  /** Time to first token in ms. */
  ttftMs: number;
  totalMs: number;
  interrupted: boolean;
}

export type ToWorker =
  | {
      type: "load";
      id: number;
      repo: string;
      revision: string;
      family: "qwen3" | "gemma4";
      backend: Backend;
    }
  | { type: "generate"; id: number; messages: ChatMessage[]; maxNewTokens: number }
  | { type: "interrupt" }
  | { type: "dispose"; id: number };

export type FromWorker =
  | { type: "progress"; id: number; loadedBytes: number; totalBytes: number }
  | { type: "status"; id: number; phase: "loading" | "warming" }
  | { type: "loaded"; id: number; backend: Backend; loadMs: number }
  | { type: "token"; id: number; text: string }
  | { type: "generated"; id: number; stats: GenerationStats }
  | { type: "disposed"; id: number }
  | { type: "error"; id: number; message: string }
  | { type: "resources"; entries: ResourceRecord[] };
