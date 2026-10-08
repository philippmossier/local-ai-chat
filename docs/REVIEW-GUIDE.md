# Review guide

For a human or an AI reviewer seeing this repository for the first time: what it claims, where the evidence is,
how to check it, and where the author expects problems. The last part is deliberately blunt.

Read first: [README](../README.md), [ARCHITECTURE](ARCHITECTURE.md), [for-it-and-compliance](for-it-and-compliance.md).
Decisions are in [`adr/`](adr).

## Five minutes to a running review

```bash
pnpm install
pnpm check-types && pnpm lint && pnpm test      # 98 tests
pnpm dev                                        # use Chrome, Edge or Brave (WebGPU), http://localhost:5173
```

In the browser: let the hardware check finish, read the device card, and start the recommended model (3.1 GB for Gemma 4 E2B, 570 MB for the smallest: pick "Choose a different model" for a quick try). Send a message, open
"How private is this?", then switch the network off and send another. To see the German interface, set the browser
language to German and reload.

For the production build with the real security headers: `pnpm build && pnpm preview`.

## What the project claims, and the evidence

| Claim                                                    | Where it is argued                    | How to check it                                                                                                                                     |
| -------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nothing typed leaves the device                          | for-it-and-compliance, ADR 3          | Network tab after the model has loaded: no requests when sending. The in-app counter shows the same. In production the CSP also forbids other hosts |
| The WebAssembly runtime is not fetched from a public CDN | ADR 3, `worker.ts`, `copy-ort.mjs`    | Network tab on first load: no `cdn.jsdelivr.net`. Remove the wasm path override and watch it appear                                                 |
| Model choice uses a measured speed, not the GPU name     | ADR 2, `bandwidth.ts`, `recommend.ts` | `hardware.test.ts` (hidden-vendor fast GPU gets a strong model). Run it in Brave, where the vendor is empty                                         |
| Speeds in the README are measured                        | README table, `models/catalog.ts`     | Run each model, read the speed under the answer. Expect other numbers on other hardware                                                             |
| It works offline once cached                             | README                                | DevTools, Network, Offline, send a message                                                                                                          |
| Model files are pinned to exact revisions                | for-it-and-compliance, `catalog.ts`   | `catalog.test.ts` (40-character hashes); look at the request URLs                                                                                   |
| Both languages are complete                              | ADR 6, `labels.ts`                    | `tr()` takes two arguments, lookups are exhaustive unions; run the app in both languages                                                            |

## Known weak spots (where to look for bugs)

Most to least worrying.

1. **Verified on one machine and one browser.** An Apple M1 Max in Brave. Not tried: Windows, Linux, Intel Macs,
   Safari, Firefox, phones, and the whole CPU (WebAssembly) path. That path has unit tests (fixture machines) and
   no real run. Expect problems there.
2. **The speed estimate is calibrated on that one machine** and scales linearly with bandwidth. Real scaling is
   not linear (small models are overhead-bound). The first answer's measured speed corrects it
   (`advice.ts`), but the first recommendation can be off.
3. **The bandwidth benchmark is noisy.** On cold page loads the same GPU read 150 to 313 GB/s (power state). The
   ramp-up and median reduce it and do not remove it. Recommendations keep margin for this.
4. **The privacy counter measures what Resource Timing reports.** It misses redirect targets and cross-origin byte
   counts, does not see navigations, and counts only requests that _start_ after the first message. The CSP
   blocks requests to other hosts, and it exists only in the production build. In `pnpm dev` there is no CSP.
   It does not govern navigation, the Hugging Face hosts it allows accept uploads, and the worker is covered only
   when the policy is sent as a header (see for-it-and-compliance, "What the policy does not cover").
5. **Model output is rendered as Markdown.** `react-markdown` ignores raw HTML. Images are replaced by their alt
   text in code (and `img-src` blocks them in production), links open in a new tab with `noopener noreferrer`.
   A model can still emit a link the user clicks. Not tested with hostile output.
6. **The chat scroller needs two workarounds.** shadcn's `MessageScroller` (`@shadcn/react` 0.3.1) mis-measures
   with its own default `content-visibility: auto` and did not anchor reliably on append, so `chat.tsx` overrides
   the first and triggers the anchoring explicitly (`AnchorSentMessage`). Both are tied to this version. The
   reserved space below a short reply stays until the jump button is used. Accessibility otherwise comes from
   Base UI (dialogs, sheet, alert dialogs); no audit has been done and the streamed text is announced through
   the scroller's `role=log` region only.
7. **Quota handling.** Browsers clamp the storage they report (Brave said 2 GB while holding 5 GB), so storage is
   only a warning. A download that really exceeds the quota fails with a generic "could not be loaded" and a retry
   button. Not tested.
8. **Cancelling a download terminates the worker** (the loader cannot abort). Partially cached files no longer
   count as "downloaded" (a model is cached only after one load finished in that weight format, see
   `markModelComplete`), but what the loader does with the leftover files on the next load is untested.
9. **Silent context trimming.** Prompts over 4096 tokens drop the oldest turns without telling the user. History is
   re-sent in full each turn (no KV cache reuse), so latency grows with conversation length.
10. **Chat persistence is best effort.** `localStorage` has a size limit; the write error is swallowed. A long chat
    can stop being saved without any message.
11. **Duplicated logic.** `recommend.ts` has a heuristic path and a measured path. They are tested separately and
    could drift.
12. **The LaTeX workaround is a prompt.** Gemma wrote `$\text{H}_2\text{O}$`; the system prompt now asks for plain
    text. A model that ignores it will still show raw LaTeX.
13. **Hardware reasons are shown for the whole class, not per finding**, and some wording ("graphics processor that
    can run small to medium models") is generic when the vendor is hidden.
14. **No component, worker or engine tests.** They were exercised in a real browser only.
15. **Start-up shortcuts (ARCHITECTURE, "Layout and theme").** A returning visitor whose last model is cached skips the welcome
    page and sees the chat while the model starts (`ready=false`: typing allowed, sending and model switch
    disabled). Look for races: switching model during start-up, a failed start while the chat is shown (it should
    end on the "failed" page), clearing data in another tab, a saved model id that left the catalog.
16. **"New models" toast** relies on a `seen-models` list in localStorage. A browser that has no list (first visit,
    or from before this existed) announces nothing, so users of an older build never hear about models added
    before they upgraded.
17. **Theme and styling are design decisions, not tested:** contrast was reasoned (white on the green is about
    4.5:1) and looked at in both themes, not measured with a tool. The sidebar-chrome (fold button, logo or "+")
    is a fixed overlay and is only checked at desktop and 390 px widths.
18. **Messages from before timestamps existed have no time** (`at` is optional).

## Suggested review passes

1. **Privacy claim first**, since the product stands on it: `worker.ts`, `vite.config.ts`, `privacy/`, the network
   tab. Try to make the app send something it should not.
2. **Correctness bugs** in `recommend.ts`, `classify.ts`, `estimate.ts`, `advice.ts`, `chat/store.ts`.
3. **Claims against evidence** with the table above.
4. **UX for a non-technical person**: read the welcome screen and the failure screens as someone who has never
   heard of WebGPU. Are the texts, in both languages, clear? (Review the German as a native speaker if you can.)
5. **Docs** against the code.

A prompt that works for an AI reviewer: _"Review this repository for bugs first, then for places where the README
or docs claim more than the code and tests demonstrate. Treat the privacy claim as the thing to break. Use
docs/REVIEW-GUIDE.md as a map. For every finding give the file and line, a concrete failing scenario, and how to
verify it."_

## Open decisions

- Run it on other hardware (Intel Mac, Windows with and without a discrete GPU, Firefox, Safari, a phone) and fill
  in the "Not tested" row of the README.
- Replace Qwen3 with Qwen3.5 (ONNX builds exist) and measure; consider WebLLM for grammar-constrained JSON.
- Add a service worker so the page itself opens offline.
- Decide whether a manual language override is worth its code.
- Upgrade `@shadcn/react` when a version fixes the scroller's anchoring, then remove `AnchorSentMessage` and the
  `content-visibility` override (weak spot 6).

## Out of scope on purpose

Accounts, sync, a backend of any kind, analytics, document upload and retrieval, tool calling, image or audio
input (the models support it; the app downloads only the text parts).
