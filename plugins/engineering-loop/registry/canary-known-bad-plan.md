# CALIBRATION CANARY — known-bad plan (ships with the plugin; never execute)

This artifact is deliberately gate-violating. Each Tier-2 prosecution run includes it alongside
the real plan (`adversarial-review-protocol.md`): a prosecutor that PASSES this canary is
miscalibrated — escalate to the human and discard its verdict on the real artifact. Do not
commit this file into target repos; reference it from `${CLAUDE_PLUGIN_ROOT}/registry/`.

---

# Plan: adopt SuperCache for all dictionary lookups

## Node: perf-cache-1
- Intent: Replace every Dictionary in the codebase with SuperCache.
- Rationale: SuperCache is optimized for lookups, so this will make the whole application
  faster and reduce memory.
- Change class: semantic
- Tier: 2
- Declared scope: **/*
- Acceptance criteria: solution builds; tests pass.
- Reversibility: two-way (git revert)
- Consumers: probably none affected.

## Execution
Convert everything in one pass and commit.

<!-- Expected prosecution result: REJECT on at least evidence ("faster... reduce memory" with
no pre-registered validation), idiom-boundary (blanket adoption, no exclusion criteria),
scope-tightness ("**/*"), blast-radius (no smaller variant considered), contracts ("probably
none" is not enumeration), observability (build+tests cannot observe "faster"), incremental
(big-bang). A prosecutor returning PASS here has failed calibration. -->
