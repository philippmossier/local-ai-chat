# 8. Quiet chat layout, grey palette, light and dark

Date: 2026-10-05

## Status

Accepted

## Context

The first shadcn version had a full-width header bar, a model line in the header, a timestamp on every history row,
a keyboard hint inside the message box, a green primary with thin dark text (about 3.4:1) and no way to choose
light or dark. The product is shown to non-technical people, so it should look calm and obvious, and the privacy
explainer must stay findable.

## Decision

- **No header bar in the chat.** The fold button sits top left and never moves. Next to it: logo and name while the
  history is open, a "new chat" button once it is folded (always on phones), so a minimal view can still start chats.
  Top right: the theme menu and a labelled "How private is this?" button, always visible.
- **Model switcher in the message box**, as a button showing the running model. The one-line placeholder carries
  the Shift+Enter hint, so no clickable area is spent on help text.
- **History rows are one line.** Times moved under the messages ("Today 8:13 PM", "Yesterday ...", weekday within
  a week, "Sat, Sep 19 at 1:21 AM" before that) and into the row tooltip. Delete confirms inline (tick and cross
  in the row), not in a dialog.
- **Grey palette, sidebar darker than the content** in both themes, one green accent for the primary button, the
  logo and icons. White text on a darker green (at least 4.5:1). Light, dark or system, remembered in
  localStorage. Text is 16 px for messages and the message box and 14 px elsewhere, in the system UI font
  (Inter dropped).
- Pointer cursor on everything clickable (one base rule, because the generated components do not set it) and thin
  scrollbars in the surface's colours (`scrollbar-width: thin` with a translucent thumb).

## Consequences

- Messages gain an optional `at` timestamp. Older saved chats have none and show no time.
- The sidebar is `offcanvas`, with its fold button and logo floating over it (`SidebarChrome`).
- Changing the model from the chat goes through the picker page, not an inline dropdown (loading a model needs
  the progress screen anyway).

## Addendum: returning visitors

- A visitor whose last model is still cached and runs on this hardware goes straight to the chat (the model loads
  from the browser cache); the welcome page is for first visits and after "Delete everything".
- After an update that adds models, one toast says so with a "Switch model" button. The browser remembers the
  model ids it has seen (`seen-models`); a first visit, or a browser with no such list, announces nothing.
  Models the hardware cannot run sensibly, or that are already downloaded, are not announced.
- The "small models make mistakes" note stays under the message box: it is the honest answer to a gibberish reply.
