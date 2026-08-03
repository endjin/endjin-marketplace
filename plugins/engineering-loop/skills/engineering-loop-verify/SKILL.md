---
name: engineering-loop-verify
description: "This skill should be used for phase 4 of the engineering loop — running the inner verification gauntlet (build/test/format at full strictness, pre-registered evidence, risk-relevant matrix) and closing the outer loop (polling CI to a terminal state, flaky classification). USE FOR: \"verify this slice\", running pre-registered benchmarks, watching CI for the loop. DO NOT USE FOR: authoring benchmarks as designs (engineering-loop-plan pre-registers them), addressing review comments (engineering-loop-review), or one-off test runs outside a loop (use the /engloop-verify command or the platform's own tooling directly)."
---

# Phase 4 — Verify (inner + outer)

"It builds" is a proxy; verify the outcome. Green means: gauntlet green **and** pre-registered
evidence executed **and** CI terminal-green on the exact head SHA.

## Inner loop — the gauntlet

Run the platform pack's gauntlet (e.g. `references/platforms/dotnet.md`) **ordered
fastest-and-cheapest-first** so failures surface early. At full strictness — warnings as errors,
style enforced in build, format verified — and with the full test suite, expected counts pinned;
any drift in totals (new skips, fewer tests) is a signal, not noise. **No platform pack? Use
the agnostic fallback gauntlet:** the repo's own build/test/lint entry points (Makefile, npm
scripts, `tests/*.sh`, CI steps read from the workflow file) at the strictest settings
discoverable — state what was inferred and from where.

Non-negotiables:
- **Confirm the evidence gate closed at Plan.** Claim-bearing nodes ran their pre-registered
  evidence *before mutation* (Plan phase); here, verify the verdict is on record and — for
  plan-recorded thinnest-slice rules — run the registered measurement now, before the slice
  may merge. Missing its threshold auto-fails the node — do not move the goalposts after
  seeing the number. Interrogate results that flatter the hypothesis as hard as surprises.
- **Risk-relevant matrix** — verify every axis the change touches (configs, TFMs, OSes; for
  data: run-modes, partitions, late/duplicate/malformed inputs; scale and skew, not just a tidy
  sample). The convenient subset is negligence; "what about the other target?" must have an
  answer before review.
- **Behavioural check on any bulk transform.** Auto-fixers silently change semantics; a
  green compile after a codemod proves nothing — the test pass does.
- **Compiles ≠ works.** Where runtime behaviour is the risk (legacy TFMs, platform-dependent
  code, external systems), execute it — tests, a dry-run, a canary.
- **Prove-not-quiet.** A silenced signal with its complaint intact fails this phase (the
  diff-prosecutor re-checks in phase 5, but catch it here first — feedback is cheapest at the
  source).

Record the gauntlet outcome as a verdict in `gates.json` `.verdicts[]`
(`{node, gate: "gauntlet", verdict: "PASS"|"FAIL", detail: {steps, test_counts}, timestamp}` —
plus the canonical record's `run` and `prosecutor: null` fields per the router schema)
and per-phase timings to the metrics ledger (`references/method/measurement.md`).

## Outer loop — CI to terminal state

After push, poll CI per `references/method/outer-loop-ci-and-review.md`:
- Pin to the **exact head SHA**; require **all** required checks terminal; verify the run set is
  non-empty before trusting green (a watcher that polled nothing has proven nothing).
- On failure: **classify flaky-vs-real first** (retry once for infra-shaped failures). Never
  mutate code to appease an unclassified failure. Real failures are root-caused and fixed at
  source — through Execute's slice protocol, not as drive-by edits.
- Long waits run as background tasks (`ci-watcher` agent); auth/rate-limit stalls halt the loop
  loudly rather than retrying forever. Recurring failure classes raise andon → kaizen mid-loop.
- No CI configured → say so, record a `{gate: "ci", verdict: "ABSENT"}` verdict, rely on the
  local gauntlet, and move on. Never block on a signal that cannot arrive. (`ABSENT` = no CI
  exists; `NO_RUNS` = CI exists but was not triggered for this SHA — different findings.)

## Exit gate

`gates.json` per node: gauntlet PASS, evidence executed + passed, matrix covered; CI
terminal-green per node — or one run-level `ci: ABSENT` record (`node: null`) covering all. Nodes advance to `verified`. **Failure routing:** a gauntlet or
matrix FAIL routes the node back to Execute as a new/split slice (status returns to
`executing`; the failure is a `rework` metrics event); an evidence FAIL kills the node
(`killed`) per the evidence gate. Hand off to `engineering-loop-review`.
