# 7. shadcn components, including the chat primitives

Date: 2026-10-05

## Status

Accepted

## Context

The first chat UI was hand-built with Tailwind: a scroll hook with its own spacer maths, bubbles as styled divs, a
drawer, a dialog. It worked and was verified in a browser, and it had real gaps (no focus trap in the dialog,
copy-pasted colours, a bespoke scroll implementation to maintain). My rule is to
use library components instead of hand-rolling them, and shadcn ships chat primitives (`MessageScroller`, `Message`,
`Bubble`) next to the usual ones.

## Decision

Rebuild the UI on shadcn (`base-vega` style, neutral base, lucide icons, as in my other apps), with the
brand colour set through `--primary`. Delete the hand-written scroll hook, scroll maths, icons, drawer and dialog.
Use `Sidebar` (a sheet on phones), `InputGroup`, `Empty`, `Alert`, `Dialog`, `AlertDialog`, `Progress`, `Card`.

## Consequences

- Less code to own, focus management and keyboard handling from Base UI, and a bottom fade, jump-to-latest button
  and anchoring from the scroller.
- The scroller did not work out of the box. In `@shadcn/react` 0.3.1 its default `content-visibility: auto` broke
  its measurements, `autoScroll` follows the stream instead of holding the sent message, and its automatic
  anchoring did not fire in long threads. Measured and worked around with the scroller's own `scrollToMessage`
  (ARCHITECTURE, "The chat area"). The behaviour I wanted, a sent message held near the top while the
  reply streams below, is achieved with the library's code and verified numerically.
- Generated files live in `src/components/ui/` and are not hand-edited, with one exception: `use-mobile.ts`
  was rewritten with `useSyncExternalStore` because the generated version failed the React lint rules.
- The CLI imports a `cn` npm package; the fix-up after each `add` is in CLAUDE.md.
- A future `@shadcn/react` upgrade may make the workarounds unnecessary: re-measure, then remove them.
