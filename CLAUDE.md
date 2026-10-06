# CLAUDE.md

Instructions for AI assistants working in this repository.

## What this is

Local AI Chat (German UI: "Lokaler KI-Chat"): a chat that runs an open language model inside the browser tab,
with a hardware check that picks the model. Static single-page app, **no backend by design**. The product stands
on one claim, that nothing typed leaves the device. Read `README.md`, `docs/ARCHITECTURE.md`,
`docs/for-it-and-compliance.md`; `docs/REVIEW-GUIDE.md` lists known weak spots.

## Commands

```bash
pnpm install
pnpm dev                      # Vite, http://localhost:5173 (no CSP in dev)
pnpm check-types && pnpm lint && pnpm test      # run before finishing any change
pnpm build && pnpm preview    # production build with the real CSP and isolation headers
```

`pnpm dev` and `pnpm build` run `scripts/copy-ort.mjs` first (copies the WebAssembly runtime into `public/ort`).

## Rules

- **The privacy claim is the contract.** Do not add any network request, third-party script, font, analytics,
  error reporting or CDN. If a new host is unavoidable, add it to the CSP in `vite.config.ts`, to the table in
  `docs/for-it-and-compliance.md`, and say so in the PR. Never weaken the CSP to make something work.
- **No backend, no accounts, no telemetry.**
- **Do not commit** unless asked.
- **No i18n library.** Text is `tr("English", "Deutsch")` next to the code; run-time-chosen text goes in
  `src/lib/labels.ts` as an exhaustive lookup. Always write both languages. Format numbers with `decimal`
  from `src/lib/format.ts`. See ADR 6.
- **Speeds and sizes in the README and catalog must be measured**, with the date and the hardware. Never estimate
  and present as measured. When adding a model: pin the commit hash, sum the real file sizes, run it in a browser.
- **Hardware assumptions are guesses.** Do not hard-code behaviour on a GPU vendor name (browsers hide it); use the
  measured bandwidth and the speed of the first answer.
- Tests run without a GPU, network or models. Anything that needs them is verified by running the app and said so.
- Verify scripted edits: a search-and-replace that matches nothing fails silently (prettier reformats code).
  Assert the replacement applied, or use the editor tool.
- Style: TypeScript strict, Prettier, no em dashes in prose, comments or commit messages.
- Do not copy code, prompts or data from other projects without permission.

## UI: shadcn first

- **Use built-in shadcn components instead of hand-rolling.** Look at `src/components/ui/` and
  `npx shadcn@latest search` before writing markup. Chat UI uses `MessageScroller`, `Message`, `Bubble`, `Sidebar`,
  `InputGroup`, `Empty`, `AlertDialog`; do not write scroll hooks, bubble divs, drawers or dialogs by hand.
- Add components with `npx shadcn@latest add <name> --yes --overwrite` (the repo uses the `base-vega` style, neutral
  base, lucide icons, `~` alias; `components.json` is committed). **After every `add`**, run
  `grep -rl 'from "cn"' src | xargs sed -i '' 's#from "cn"#from "~/lib/utils"#'`: the CLI imports an npm package
  named `cn` which this repo does not use (its own `cn` is clsx + tailwind-merge in `lib/utils.ts`).
- Theme through the CSS variables in `src/styles.css` (the brand colour is `--primary`). **No raw colour classes**
  (`bg-emerald-600`, `text-zinc-500`): use `bg-primary`, `text-muted-foreground`, `bg-muted`, etc.
- Icons come from `lucide-react`. Inside shadcn components use `data-icon="inline-start"` and no size classes.
- Layout with `flex` and `gap-*`, not `space-x/y-*`. Dialog, Sheet and AlertDialog always have a title.
- The chat scroller has two documented workarounds in `src/components/chat.tsx` (see ARCHITECTURE, "The chat area").
  Keep them until `@shadcn/react` is upgraded and the behaviour is re-measured in a real browser.

## Gotchas

- Use Chrome, Edge or Brave for WebGPU. In Brave the GPU vendor string is empty and the CPU thread count is
  randomised. Storage quota is clamped.
- Do not edit `src/` while a long browser test runs against `pnpm dev`: hot reload restarts the page.
- The browser cache is per origin and per pinned revision. Changing a model's `revision` re-downloads it.
- `pnpm` 11 needs `allowBuilds` in `pnpm-workspace.yaml`; `onnxruntime-node` is switched off (browser-only app).
