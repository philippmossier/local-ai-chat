// Copies the ONNX Runtime WebAssembly files next to the app so the browser never has to fetch
// them from a public CDN (the library's default). Run automatically before dev and build.
import { cpSync, mkdirSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const transformers = require.resolve("@huggingface/transformers");
// onnxruntime-web does not export its package.json, but its main entry lives in dist/ next to the wasm files.
const from = path.dirname(createRequire(transformers).resolve("onnxruntime-web"));
const to = path.resolve("public/ort");

mkdirSync(to, { recursive: true });
// jspi = 64-bit build for Chromium (large models), asyncify = 32-bit fallback for other browsers,
// unsuffixed = Safari below 26 without WebGPU
const wanted = /^ort-wasm-simd-threaded(\.asyncify|\.jspi)?\.(mjs|wasm)$/;
const files = readdirSync(from).filter((f) => wanted.test(f));
for (const f of files) cpSync(path.join(from, f), path.join(to, f));
console.log(
  `copied ${files.length} ONNX Runtime files to public/ort: ${files.join(", ")}`,
);
