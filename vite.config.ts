import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";

/**
 * Network allowlist: requests (fetch, XHR, WebSocket, beacon) may go to this origin and to the Hugging Face Hub
 * (model downloads), nowhere else, so a bug cannot quietly post chat text to some other server.
 * Limits, see docs/for-it-and-compliance.md: CSP does not govern navigation (a clicked link, `location.href`,
 * `window.open`), and the Hugging Face hosts it allows also accept uploads. It narrows what a compromised
 * dependency can do; it does not make exfiltration impossible. The worker gets this policy only from the HTTP
 * header (`_headers`), not from the meta tag, so deploy with the header.
 * `script-src blob:` and `wasm-unsafe-eval` are required by the ONNX Runtime WebAssembly loader.
 */
export const CSP = [
  "default-src 'self'",
  "script-src 'self' blob: 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "connect-src 'self' https://huggingface.co https://*.huggingface.co https://*.hf.co",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

// Cross-origin isolation unlocks multi-threaded WebAssembly, which matters for the CPU fallback.
const ISOLATION = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

/** Production only: dev needs inline scripts for hot reload. Emits CSP as a meta tag and a `_headers` file. */
function securityPolicy(): Plugin {
  return {
    name: "security-policy",
    apply: "build",
    transformIndexHtml: () => [
      {
        tag: "meta",
        attrs: { "http-equiv": "Content-Security-Policy", content: CSP },
        injectTo: "head-prepend",
      },
    ],
    generateBundle() {
      const lines = [
        "/*",
        `  Content-Security-Policy: ${CSP}`,
        ...Object.entries(ISOLATION).map(([k, v]) => `  ${k}: ${v}`),
      ];
      lines.push(
        "  X-Content-Type-Options: nosniff",
        "  Referrer-Policy: no-referrer",
        "",
        "/ort/*",
        "  Cache-Control: public, max-age=31536000, immutable",
        "",
      );
      this.emitFile({ type: "asset", fileName: "_headers", source: lines.join("\n") });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), securityPolicy()],
  resolve: { alias: { "~": path.resolve(import.meta.dirname, "./src") } },
  worker: { format: "es" },
  build: { target: "esnext" },
  optimizeDeps: { exclude: ["@huggingface/transformers"] },
  server: { headers: ISOLATION },
  preview: { headers: { ...ISOLATION, "Content-Security-Policy": CSP } },
});
