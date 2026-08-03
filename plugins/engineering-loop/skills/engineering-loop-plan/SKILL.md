---
name: engineering-loop-plan
description: "This skill should be used for phase 2 of the engineering loop — writing per-node plans with evidence gates, pre-registering validation, recording idiom allow/deny decisions, locking declared scope, and (at Tier 2) submitting the plan to blind adversarial prosecution. USE FOR: \"plan this node\", pre-registering a benchmark/A-B, preparing a plan for prosecution. DO NOT USE FOR: framing/tiering (engineering-loop-frame), executing (engineering-loop-execute), reviewing diffs (engineering-loop-review), or generic planning outside a loop run."
---

# Phase 2 — Plan with evidence gates

The core of the loop: no risky claim proceeds on plausibility. Per node, produce a plan that
satisfies the Definition of Ready and — at Tier 2 — survives blind prosecution *before any code*.

## Per-node plan

For each pending node in `work-graph.json`, record:

1. **Hypothesis + acceptance criteria** — checkable (a test, a metric, an observable outcome).
2. **Evidence** — if the node claims any quality attribute (faster, smaller, safer, cheaper,
   more reliable), **pre-register AND EXECUTE the validation now — before any mutation**.
   Spawn `evidence-designer`: it writes `evidence/<node-id>/preregistration.md` (metric,
   threshold, workload = the system's actual shapes, required n/significance — immutable once
   registered, content hash recorded in the evidence verdict), checks falsifiability (could
   this experiment actually fail?), runs it, and appends the PASS/FAIL evidence verdict to
   `gates.json .verdicts[]`. **At Tier 2 the full ordering is fixed:** (1) registration →
   (2) the `falsifiability` lens is prosecuted against the registration by a single prosecutor
   (design-review, before cost is sunk) → (3) evidence executes → (4) the **full N-up panel**
   prosecutes the completed plan with the evidence verdict present. At Tier 1
   evidence-designer's own falsifiability check suffices. **A claim-bearing node cannot leave Plan without an executed
   evidence verdict: PASS → proceed; FAIL → the node is `killed` here, with nothing built.**
   The only exception is evidence that *requires* the mutation to exist
   (thinnest-slice-that-measures / build-to-learn): then the plan records the decision rule
   ("build the minimal slice, measure, keep-or-kill by the registered bar") and Verify runs
   it before the slice may merge. Protocol: `references/method/evidence-gate-protocol.md`.
   Write each node's plan to `plans/<node-id>.md` — that file is the artifact prosecutors
   receive.
3. **Idiom allow/deny** — every pattern/tool adoption gets an explicit boundary: where it
   applies, where it stops, exclusion criteria. "Use X where appropriate", never "everywhere".
4. **Declared scope, locked** — expected files/resources/artifacts + change-class. Tight, not
   defensive: over-broad scope means nothing ever counts as drift, and is itself a violation.
   Locked at Plan exit; Execute may not widen it silently.
5. **Reversibility + blast radius** — one-way doors need an engineered reversal path or a
   forward-fix strategy, and an explicit human go/no-go.
6. **Consumers** — for any observable change: enumerate them (lineage, contract tests) and pick
   a compatibility strategy (additive / expand-contract preferred).
7. **Matrix** — declare the risk-relevant verification axes now (configs, targets, run-modes,
   data shapes) so Verify exercises what Plan promised. A trivial single-axis node still
   records `matrix: none declared` — absence must be a decision, not an omission.
8. **Non-claim evidence artifacts** (a bug fix's failing test, a feature's acceptance list)
   need no evidence *verdict*; record their content hash in the `detail` of the node's
   gauntlet verdict at Verify instead.

Check every item against the merged `plan-checklist.yaml` registry (seed + overlays, filtered by
`applies_when`). Unmet items block entry to Execute unless explicitly waived (logged).

## Prosecution (Tier 2) / self-review (Tier 1)

- **Tier 2:** spawn `plan-prosecutor` subagents — blind (they see the plan + gate criteria,
  never the persuasive rationale), lenses loaded from the merged registry, structured verdicts
  written to `gates.json`. First verdict binds; no re-rolling on an unchanged plan. Include the
  calibration canary. A REJECT must cite a lens id + quoted plan text or it is void. Protocol:
  `references/method/adversarial-review-protocol.md`.
- **Tier 1:** one self-review pass over the same lens registry (`prosecutor: "self"`);
  findings are advisory (warn-and-ask). Advisory outcomes are still recorded — append the
  verdict to `gates.json` `.verdicts[]` with `"detail": {"advisory": true, ...}`; **a pass
  with any unresolved finding records `REJECT` (advisory)**, `PASS` only when no finding
  stands; on-the-record beats remembered. Amending the plan to resolve a finding creates a
  new plan version — a `PASS` on v2 is legal and is not a re-roll (first-verdict-binds
  constrains *panels* on *unchanged* artifacts, not self-review on amended ones).

## Human sign-off

Present the plan (with any prosecution findings) for approval — this checkpoint can never be
self-satisfied. The human may edit the plan (rejecting nodes, changing mechanisms, relaxing or
tightening constraints); apply edits and re-record. If invoked with `--plan-only`, stop here.

## Exit gate

Every node: DoR satisfied or waived-with-justification; evidence pre-registered where required;
scope locked; Tier-2 nodes survived prosecution; human sign-off obtained. Statuses updated in
`work-graph.json`; hand off to `engineering-loop-execute`.
