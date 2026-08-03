---
name: engineering-loop-frame
description: "This skill should be used for phase 1 of the engineering loop — framing a workload, clarifying the real goal vs the literal ask, detecting platform/workload/architecture context, sizing and tiering the work, and building the work-graph in .engineering-loop/work-graph.json. USE FOR: starting a new loop run, \"frame this work\", re-planning the graph mid-flight. DO NOT USE FOR: writing the per-node plans (engineering-loop-plan), executing changes (engineering-loop-execute), or generic project exploration outside a loop run."
---

# Phase 1 — Frame & map

Turn a raw ask into a confirmed goal, a detected context, and a tiered work-graph. Nothing is
built here; everything downstream depends on this being honest.

## The first-5-minutes contract

Produce, fast and in this order — no wall of ceremony:
1. **Restated real goal** (one line) with an inline confirm — *solve the real problem, not the
   literal ask*. The ask "make sure the archived projects run" may really mean "opening them in
   the IDE must be quiet"; confirm before optimising the wrong thing.
2. **Tier + one-line why** (see below).
3. **Plan-at-a-glance** (≤5 bullets), then go. Detail on request, not pushed.

## Detect context (confidence-scored)

Run the router's detection table (platform, CI system, workload type, architecture class). State
what was detected, the evidence, and the confidence. Low confidence → agnostic defaults + ask;
never guess silently. Then load the matching `references/platforms/*`, `references/playbooks/*`,
and `references/design-principles/*` packs before planning. For large or unfamiliar workloads,
delegate the survey to the `work-surveyor` agent; doing it inline is fine for small ones.

## Build the work-graph

Decompose the workload into **atomic, independently verifiable nodes** (not a linear checklist).
Write `.engineering-loop/work-graph.json` using the **router skill's canonical node schema**
(that field list governs; this is the same record): per node record `id`,
`intent` (one sentence), `change_class` (mechanical | semantic | config),
`risk`, `reversibility` (one-way | two-way door), `blast_radius` (declared impact surface),
`required_evidence` (true for ANY quality-attribute claim — faster/smaller/safer/cheaper),
`tier` + `tier_reason` (see below), `declared_scope` (`{files[], rationale}` — drafted here,
locked at Plan; change-class lives at node level), `edges`
(`[{type: "must-precede"|"depends-on", node}]`), `status: pending`.

Order nodes economically: cost-of-delay ÷ duration (CD3) alongside foundation-first and
risk-first — `references/method/ordering-strategies.md`. Sketch the value stream: where will the
time and the waits actually go, and what is the constraint (usually human review attention)?
Never add ceremony to non-constraints.

## Tier each node

- **Tier 0 Express** — trivial, low-risk, reversible (typo, comment, guarded one-liner,
  dependency bump with green tests): collapses the loop to understand → change → verify.
  **Escalation floor:** any change that touches test expectations, assertions, or suppressions
  is at least **Tier 1** — assertion-strength edits must pass the prove-not-quiet self-review,
  which Tier 0 skips. (A typo fix whose tests pin the typo is therefore Tier 1, not Tier 0.)
- **Tier 1 Standard** — the default for real work: all phases, single-pass, gates advisory.
- **Tier 2 Full** — forced by any of: a quality-attribute claim (non-negotiable — the
  frozen-collections lesson), one-way-door effects, high blast radius, security-sensitive paths.

Auto-select from cheap signals (predicted files, change-class, reversibility, claims). State the
tier and why in one line; the human can override with one token — but overriding *down* from a
claim-forced Tier 2 requires an explicit, logged accept-with-justification. Batch consecutive
same-tier mechanical nodes for one gauntlet pass. `references/method/right-sizing.md` governs.

## Exit gate

Frame is done when: the real goal is human-confirmed **and recorded as the `real-goal-confirm`
checkpoint in `gates.json`** (likewise `detection-confirm`) — a verbal confirm with no record
breaks the resume no-re-demand contract; detection is confirmed or defaulted-with-ask; the
work-graph exists with tiers, DoR fields, and ordering; and the human has seen the
plan-at-a-glance. **Emit the phase-exit event to `.engineering-loop/metrics.jsonl`** (schema in
`references/method/measurement.md`; every phase does the same at its exit — detection-time
`gate_verdict` events, e.g. `ci: ABSENT` discovered here, may legitimately precede it) and
**commit the state per the router's state-commit rule**. Then hand off to
`engineering-loop-plan` via the state file.

Mid-flight re-entry: when reality contradicts the graph (a node explodes, a dependency inverts),
return here, re-plan the graph, and say so — responding to change beats following the plan.
