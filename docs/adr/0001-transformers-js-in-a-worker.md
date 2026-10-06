# 1. Transformers.js and ONNX Runtime Web, in a Web Worker

Date: 2026-10-05

## Status

Accepted

## Context

Running a language model in a browser tab has three realistic engines: WebLLM (MLC, WebGPU only, its
own model format), wllama (llama.cpp compiled to WebAssembly, GGUF models, CPU, optional WebGPU) and
Transformers.js on ONNX Runtime Web (WebGPU and a WebAssembly CPU fallback, ONNX models).

## Decision

Transformers.js. One engine and one model format cover both the GPU path and the CPU fallback, and
Gemma 4 (April 2026, Apache-2.0) had ready ONNX exports at the time of writing. WebLLM offers
grammar-constrained JSON output and newer Qwen models, but I found no Gemma 4 build in its prebuilt list.
That trade (constrained decoding against a model family) is open: see "Not here yet". All inference runs in a dedicated worker so the page stays responsive,
and the main thread talks to it through a small typed message protocol.

## Consequences

- Model files are large: the smallest useful model is 570 MB, Gemma 4 E2B about 3.1 GB for text only.
  Loading `Gemma4ForCausalLM` instead of the multimodal class skips the vision and audio encoders.
- Single-file models above roughly 1 GB (Qwen3 1.7B is 1.4 GB) fail to load on the 32-bit WebAssembly
  build with `std::bad_alloc`. The app uses the 64-bit JSPI build where the browser supports it
  (Chromium) and falls back to the 32-bit one elsewhere, where the larger single-file models may fail.
- Cancelling a download means terminating the worker, because the loader has no abort signal.
