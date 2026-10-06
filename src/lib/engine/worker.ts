/// <reference lib="webworker" />
import {
  AutoModelForCausalLM,
  AutoTokenizer,
  env,
  InterruptableStoppingCriteria,
  TextStreamer,
  type PreTrainedModel,
  type PreTrainedTokenizer,
} from "@huggingface/transformers";
import type { ChatMessage, FromWorker, ResourceRecord, ToWorker } from "./protocol";

/**
 * All inference runs here, off the UI thread, so typing and scrolling stay smooth while the model works.
 *
 * Privacy-relevant configuration:
 *  - models are only ever fetched from the Hugging Face Hub (see the CSP in vite.config.ts),
 *  - the WebAssembly runtime is served from this origin instead of the library's default CDN,
 *  - weights are kept in the browser's Cache Storage, so the download happens once.
 */
env.allowLocalModels = false;
env.useBrowserCache = true;

/**
 * Which build of the WebAssembly runtime to use. The 64-bit JSPI build can parse models larger than
 * about 1 GB (the 32-bit one dies with std::bad_alloc), but needs JavaScript Promise Integration,
 * which only Chromium-based browsers ship so far.
 */
function ortFlavor(): "jspi" | "asyncify" | "plain" {
  if ("Suspending" in WebAssembly) return "jspi";
  const oldSafari =
    /^((?!chrome|android).)*safari/i.test(self.navigator.userAgent) &&
    !("gpu" in self.navigator);
  return oldSafari ? "plain" : "asyncify";
}
const suffix = { jspi: ".jspi", asyncify: ".asyncify", plain: "" }[ortFlavor()];
const wasm = env.backends.onnx.wasm;
if (wasm) {
  wasm.wasmPaths = {
    mjs: `${self.location.origin}/ort/ort-wasm-simd-threaded${suffix}.mjs`,
    wasm: `${self.location.origin}/ort/ort-wasm-simd-threaded${suffix}.wasm`,
  };
}

/** Sampling settings recommended by each model's authors for chat. */
const SAMPLING = {
  qwen3: { temperature: 0.7, top_p: 0.8, top_k: 20 },
  gemma4: { temperature: 1.0, top_p: 0.95, top_k: 64 },
} as const;

/** Keep memory use predictable: older turns are dropped once the prompt would exceed this. */
const MAX_PROMPT_TOKENS = 4096;

const post = (message: FromWorker) => self.postMessage(message);

let tokenizer: PreTrainedTokenizer | null = null;
let model: PreTrainedModel | null = null;
let family: "qwen3" | "gemma4" = "qwen3";
const stopping = new InterruptableStoppingCriteria();

// Report every network request the worker makes, so the UI can show what really left the device.
new PerformanceObserver((list) => {
  const entries: ResourceRecord[] = list.getEntries().map((e) => {
    const r = e as PerformanceResourceTiming;
    return {
      url: r.name,
      host: new URL(r.name).host,
      bytes: r.transferSize || r.encodedBodySize || 0,
      startedAt: self.performance.timeOrigin + r.startTime,
      source: "worker" as const,
    };
  });
  if (entries.length > 0) post({ type: "resources", entries });
}).observe({ type: "resource", buffered: true });

async function load(msg: Extract<ToWorker, { type: "load" }>) {
  const started = performance.now();
  await dispose();
  family = msg.family;
  post({ type: "status", id: msg.id, phase: "loading" });

  let loaded = 0;
  const progress_callback = (info: {
    status: string;
    loaded?: number;
    total?: number;
  }) => {
    if (info.status === "progress_total") {
      loaded = info.loaded ?? loaded;
      post({
        type: "progress",
        id: msg.id,
        loadedBytes: loaded,
        totalBytes: info.total ?? 0,
      });
    }
  };

  tokenizer = await AutoTokenizer.from_pretrained(msg.repo, {
    revision: msg.revision,
    progress_callback,
  });
  // Loading the CausalLM class makes Transformers.js skip Gemma 4's vision and audio encoders.
  model = await AutoModelForCausalLM.from_pretrained(msg.repo, {
    revision: msg.revision,
    dtype: msg.backend.dtype,
    device: msg.backend.device,
    progress_callback,
  });

  // The first run compiles GPU shaders. Do it now so the first real answer is not penalised.
  post({ type: "status", id: msg.id, phase: "warming" });
  const warm = tokenizer("Hello");
  await model.generate({ ...warm, max_new_tokens: 2, do_sample: false });

  post({
    type: "loaded",
    id: msg.id,
    backend: msg.backend,
    loadMs: Math.round(performance.now() - started),
  });
}

/** Drop the oldest turns until the prompt fits. The system message and the latest turn always stay. */
function fitToContext(messages: ChatMessage[]) {
  const tok = tokenizer!;
  const build = (m: ChatMessage[]) =>
    tok.apply_chat_template(m, {
      add_generation_prompt: true,
      return_dict: true,
      // Extra keys are passed through to the model's chat template. Not part of the typings.
      ...({ enable_thinking: false } as object),
    }) as unknown as { input_ids: { dims: number[] } };

  let kept = messages;
  let inputs = build(kept);
  while (inputs.input_ids.dims[1]! > MAX_PROMPT_TOKENS && kept.length > 2) {
    const firstTurn = kept[0]?.role === "system" ? 1 : 0;
    kept = [...kept.slice(0, firstTurn), ...kept.slice(firstTurn + 1)];
    inputs = build(kept);
  }
  return inputs;
}

async function generate(msg: Extract<ToWorker, { type: "generate" }>) {
  if (!model || !tokenizer) throw new Error("No model is loaded.");
  const inputs = fitToContext(msg.messages);

  let tokens = 0;
  let firstTokenAt = 0;
  const started = performance.now();
  const streamer = new TextStreamer(tokenizer, {
    skip_prompt: true,
    skip_special_tokens: true,
    callback_function: (text: string) => post({ type: "token", id: msg.id, text }),
    token_callback_function: () => {
      if (tokens === 0) firstTokenAt = performance.now();
      tokens++;
    },
  });

  stopping.reset();
  await model.generate({
    ...inputs,
    max_new_tokens: msg.maxNewTokens,
    do_sample: true,
    ...SAMPLING[family],
    streamer,
    stopping_criteria: stopping,
  });

  const end = performance.now();
  const decodeMs = Math.max(1, end - firstTokenAt);
  post({
    type: "generated",
    id: msg.id,
    stats: {
      tokens,
      // Speed of the decode phase only: time to first token is reported separately.
      tokensPerSecond:
        tokens > 1 ? Math.round(((tokens - 1) / decodeMs) * 1000 * 10) / 10 : 0,
      ttftMs: Math.round(firstTokenAt - started),
      totalMs: Math.round(end - started),
      interrupted: stopping.interrupted,
    },
  });
}

async function dispose() {
  await model?.dispose();
  model = null;
  tokenizer = null;
}

/**
 * One message at a time: a load that arrived during a generation would otherwise dispose the model under it.
 * Interrupt skips the queue, because it has to reach the generation that is running.
 */
let queue: Promise<void> = Promise.resolve();
self.onmessage = (event: MessageEvent<ToWorker>) => {
  const msg = event.data;
  if (msg.type === "interrupt") {
    stopping.interrupt();
    return;
  }
  queue = queue.then(() => handle(msg));
};

async function handle(msg: Exclude<ToWorker, { type: "interrupt" }>) {
  try {
    if (msg.type === "load") await load(msg);
    else if (msg.type === "generate") await generate(msg);
    else if (msg.type === "dispose") {
      await dispose();
      post({ type: "disposed", id: msg.id });
    }
  } catch (err) {
    post({
      type: "error",
      id: msg.id,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
