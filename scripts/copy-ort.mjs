// Copies the ONNX Runtime WebAssembly files next to the app so the browser never has to fetch
// them from a public CDN (the library's default). Run automatically before dev and build.
import {
  cpSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
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

// Static hosts cap the size of one file (Cloudflare: 25 MiB). The asyncify build is about 27 MB, so it is
// stored as two parts that the worker fetches and joins (see SPLIT_WASM in the worker).
const MAX_FILE = 24 * 1024 * 1024;
for (const f of files.filter((f) => f.endsWith(".wasm"))) {
  const file = path.join(to, f);
  const size = statSync(file).size;
  if (size <= MAX_FILE) continue;
  const bytes = readFileSync(file);
  const half = Math.ceil(size / 2);
  if (half > MAX_FILE)
    throw new Error(`${f} needs more than two parts; update the worker`);
  writeFileSync(`${file}.part0`, bytes.subarray(0, half));
  writeFileSync(`${file}.part1`, bytes.subarray(half));
  rmSync(file);
  console.log(`split ${f} into two parts`);
}
console.log(
  `copied ${files.length} ONNX Runtime files to public/ort: ${files.join(", ")}`,
);
