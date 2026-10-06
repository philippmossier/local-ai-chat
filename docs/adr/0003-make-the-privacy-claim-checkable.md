# 3. Make the privacy claim checkable, not just stated

Date: 2026-10-05

## Status

Accepted

## Context

"Your data never leaves your device" is what every privacy page says. The audience for this app
(organisations that avoid US cloud services for compliance reasons) has heard it too often to accept
it as a statement. They accept evidence and constraints they can inspect.

## Decision

- **No backend.** The app is static files. There is no server that could receive a message.
- **The runtime is served from the same origin.** By default Transformers.js loads its WebAssembly
  engine from a public CDN at runtime. `scripts/copy-ort.mjs` copies those files into the app and
  the worker points at them, so no third party sees a visit.
- **A Content-Security-Policy allowlist** (meta tag and `_headers` file): the page may connect to its own
  origin and to the Hugging Face Hub, nothing else. A bug cannot post chat text to another server because
  the browser refuses the connection. (Corrected 2026-10-06: the first version said a compromised
  dependency could not either. It can still navigate, which CSP does not govern, or upload to Hugging Face,
  which the allowlist permits; and the worker is covered only by the header, not the meta tag. Details in
  `docs/for-it-and-compliance.md`.)
- **A live counter.** The privacy panel records every request made by the page and by the worker
  (browser Resource Timing) and shows how many happened after the first message was sent. Expected
  value: zero. It is a measurement, and it reads the same data as the browser's Network tab.
- **Honest limits in the UI.** The page and the model files are still downloaded over the internet,
  so those servers see an IP address like any website does.

## Consequences

Strict hosts and self-hosted model mirrors (`env.remoteHost`) are the next step for organisations
that cannot allow Hugging Face at all; not implemented yet. Resource Timing does not expose redirect
targets or byte counts for cross-origin responses, so model download sizes come from the loader's
progress events, not from the panel.
