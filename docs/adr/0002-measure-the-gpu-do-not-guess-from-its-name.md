# 2. Measure the GPU instead of guessing from its name

Date: 2026-10-05

## Status

Accepted

## Context

The obvious way to pick a model is to read the GPU vendor and architecture and look them up. On the
first real machine it failed: Brave returned empty strings for vendor, architecture and description,
reported 4 CPU threads on a 10-core Apple M1 Max, and clamped the storage quota to 2 GB on a disk with
250 GB free. Firefox and privacy-hardened setups do the same. Names are also a weak predictor: an
integrated GPU and a discrete one can share a vendor.

## Decision

1. Run a half-second WebGPU micro-benchmark that streams a 256 MB buffer (larger than the system
   cache of current chips) after a 250 ms GPU ramp-up, and take the median of five trials. Text generation is memory bound, so
   memory bandwidth predicts tokens per second far better than a vendor string does.
2. Turn bandwidth into an expected speed per model (each model's measured speed, scaled by bandwidth) and choose the strongest model that is
   comfortable (15 tokens/s or more). Never pre-select the largest tier.
3. Keep the vendor heuristic only as a fallback when the benchmark cannot run.
4. After the first real answer of 24 tokens or more, compare the measured speed with the estimate
   and offer one step down (under 5 tokens/s) or one step up (over 30 tokens/s).

## Consequences

The estimate is calibrated on a single machine and scales linearly with bandwidth, which is crude for
small models whose speed is limited by per-token overhead rather than memory. Step 4 exists because
of that: the app is allowed to be wrong about a device once, then corrects itself with evidence.
The benchmark briefly loads the GPU on start-up. Cold page loads still varied between 150 and 313 GB/s
on the same machine (GPU power state), so recommendations keep margin and the first answer's speed
corrects them.
