# 4. A short ladder of Apache-licensed models

Date: 2026-10-05

## Status

Accepted

## Context

A model picker with dozens of entries is for people who already know what a quantisation is. The
target user opens a link and wants to chat. Licences also matter: organisations that vet software
have to vet each model's terms.

## Decision

Four models, one per tier, all Apache-2.0: Qwen3 0.6B (Light), Qwen3 1.7B (Balanced), Gemma 4 E2B
(Strong) and Gemma 4 E4B (Best quality). The app preselects one for the machine and keeps the
others behind "Choose a different model", labelled by how well they are expected to run. A model
the hardware is not expected to carry can still be chosen ("Try anyway"): the detection is a
guess, and the person at the keyboard may know better.

Sizes shown to the user are what a text-only chat actually downloads (decoder plus embeddings, no
vision or audio encoders), summed from the Hugging Face file listing.

## Consequences

- Quality varies a lot across the ladder. Qwen3 0.6B makes visible grammar mistakes in German
  ("ist gute für die Schutz der Privatleute"), which matters for a DACH audience, so the UI says
  small models make mistakes and the recommendation moves up as soon as the hardware allows.
- A new model is one entry in `catalog.ts` plus its measured speed.
