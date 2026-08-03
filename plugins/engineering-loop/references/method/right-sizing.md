# Right-Sizing: The Loop Is a Dial, Not a Switch

Ceremony must be proportional to risk. The first act of Frame is to size the work and pick a tier — **per node**, stated in one line, overridable with one token. Phases are never skipped silently: a collapsed phase is a logged decision, not an omission.

## The three tiers

**Tier 0 — Express.** For trivial, low-risk, reversible changes. Collapses to *understand → change → verify*. No work-graph, no panel, no PR ceremony. The evidence gate degrades to "tests green, build clean". Target: no more latency than doing it by hand. This is the minimum viable loop — the method's floor, below which nothing goes.

**Tier 1 — Standard.** The default for real work. All seven phases run, single-pass and single-agent. Prosecution is one self-review over the merged lens registry, not an N-up panel. Gates are **advisory**: a failed gate warns and asks — continue, split, or abort — rather than blocking.

**Tier 2 — Full.** For high-risk, high-blast-radius work, or **any quality-attribute claim**. "Faster", "smaller", "safer", "cheaper" — any such claim *forces* Tier 2 for that node. This is the frozen-collections lesson and it is non-negotiable: a change adopted because it sounded faster shipped, was challenged in review, and only then benchmarked and reverted; the benchmark belonged before the ship. Tier 2 means: N-up blind adversarial panel, mandatory pre-registered evidence, drift-audit blocking via hooks, whole-matrix verify, active outer-loop polling. Only Tier 2 hard-blocks — and even then `skip` exists as logged accept-with-justification.

## Auto-selection signals

Tier selection reads cheap signals, not deep analysis: predicted files touched, change-class (mechanical vs semantic), blast radius, reversibility (two-way vs one-way door), and claims made in the intent. A one-file doc fix with no claims is Tier 0; a multi-project refactor is Tier 1; anything claiming a quality attribute or mutating external state is Tier 2 for the affected nodes.

## Per-node tiering, escalation, batching

Tiers attach to **nodes, not runs**. A modernisation may carry forty Tier-0 mechanical nodes and two Tier-2 nodes with performance claims; taxing all forty with panels is over-processing waste.

Tiers **escalate mid-flight on surprise**: drift found in the audit, an unexpected behavioural change, a test that reveals hidden coupling — any of these upshifts the node immediately. Escalation is automatic; de-escalation never is.

Consecutive same-tier **mechanical nodes batch** through one gauntlet pass. One verify cycle for a run of renames beats forty; batching applies only where the nodes are mechanical and same-tier — never batch a semantic change into a mechanical convoy.

## Override rules

Any tier decision is overridable with **one token** — friction on the override is itself waste. Every override is logged to the metrics ledger. One asymmetry is absolute: **down-overriding a claim-forced Tier 2 requires explicit human accept-with-justification**, recorded. The agent may propose the downgrade; only the human commits it, and the justification travels with the node.

## Control surface

Always available, at any gate, in any phase:

- `skip` — pass the gate as logged accept-with-justification.
- `abort` — stop the node or run cleanly.
- `handback` — the human takes over with full context handed off.
- `upshift` / `downshift` — change tier (down from claim-forced Tier 2 per the rule above).
- `why` — explain the current gate and the cheapest action that satisfies it.
- `--plan-only` — run Frame and Plan, show the graph and gates, stop.

## The gate-rejection message contract

Every gate rejection states exactly three things, in order: **what failed** (the specific check, with gate id and cited text) → **why it matters** (the one-line universal truth behind the gate) → **the cheapest next action** that would satisfy it. A rejection missing any of the three is malformed; vague rejections ("this seems risky") are void. The contract keeps gates teachers rather than tollbooths — and keeps gate fatigue, a tracked waste signal, at bay.
