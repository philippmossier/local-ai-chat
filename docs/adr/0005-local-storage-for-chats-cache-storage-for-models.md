# 5. Chats in localStorage, models in Cache Storage, one button to erase both

Date: 2026-10-05

## Status

Accepted

## Context

A private chat that loses everything on reload is annoying, and one that quietly keeps data forever
is not private. Models are hundreds of megabytes to gigabytes and must survive reloads.

## Decision

Conversations are kept as JSON in `localStorage` (small, synchronous, easy to inspect and delete).
Model files stay in the browser's Cache Storage, which is where Transformers.js puts them. "Delete
everything on this device" removes both plus any IndexedDB databases and the app's settings. Reading
corrupt stored data never blocks start-up: it falls back to an empty state.

## Consequences

Chats are plain text in the browser profile, readable by anyone with access to the machine's user
account. That is the same trust boundary as the downloaded files and is stated in the compliance
note. The storage quota the browser reports is treated as a hint, because privacy-oriented browsers
clamp it; a download that really does not fit fails with a clear message and a retry option.
