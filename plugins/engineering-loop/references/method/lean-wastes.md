# Lean Wastes in Software Work

Waste is any expenditure of effort, time, or attention that does not move the declared intent toward verified, shipped value. The loop exists to eliminate waste, and every waste class maps to a specific gate that attacks it. When a waste is observed without a gate that catches it, that is a kaizen trigger: root-cause to the missing gate and propose it.

## The taxonomy, mapped to gates

**Defects.** Work that ships wrong and must be found and fixed downstream. The most expensive waste because its cost multiplies with distance from the source. Attacked by: the evidence gate (pre-registered validation before claims), the gauntlet at full strictness, blind diff-prosecution before any human review, and the repeat-defect metric (a defect recurring after its gate activates means the gate itself is defective — priority kaizen).

**Over-production.** Building more than the declared intent requires: speculative abstractions, unasked-for features, gold-plating. YAGNI in gate form. Attacked by: scope declaration locked at Plan exit, drift-audit comparing the actual mutation against the declared scope, and prosecution of scope for tightness.

**Rework.** Nodes re-entering a phase already exited: reverts, re-reviews, re-planning after execution surprises. Attacked by: Plan-exit prosecution (catch the flaw before the work, not after), Definition of Ready gating entry to Execute, and the rework-rate metric making the cost visible.

**Partially-done work.** Branches that never merge, plans never executed, evidence never run. Inventory that rots. Attacked by: WIP limits with pull, one-piece flow through the stack, the Stop hook refusing to end a session with unmet gates, and trunk-releasable discipline (nothing lingers half-integrated).

**Relearning.** Solving a problem the second time from scratch. Attacked by: the kaizen registry (lessons persist as active gates across runs), decision records, and memory overlays scoped by `applies_when` so the lesson fires exactly where it applies.

**Handoffs.** Every transfer of work between contexts loses information. **Each agent boundary in this loop is a handoff** — parent to subagent, phase to phase — and the loss is real: a parent cannot read a subagent's context. The trade is deliberate: handoffs are accepted only where they buy adversarial independence (a blind prosecutor must not inherit the author's rationale) or parallelism, and the loss is bounded by structured artifacts (`work-graph.json`, `gates.json`, evidence files) that carry the state a conversation would drop. A handoff that buys neither independence nor parallelism is pure waste — collapse it.

**Waiting.** Idle time on CI, on human review, on unpolled signals. Attacked by: active outer-loop polling to terminal state (a feedback loop only exists if it is closed), fastest-cheapest-first gauntlet ordering, and value-stream sketching at Frame that names where the waits will be so they can be overlapped, not discovered.

**Task-switching.** Context thrash between concurrent nodes. Attacked by: WIP limits, batching consecutive same-tier mechanical nodes through one gauntlet pass, and economic ordering so work completes rather than accumulates.

**Over-processing.** Ceremony beyond what the risk justifies. This includes the loop itself. **The cost of the method is tracked as a first-class waste** in the flow-metrics ledger (cost-of-method); a Tier-2 panel on a typo fix is waste exactly as a missing panel on a performance claim is. Attacked by: right-sizing tiers per node, gate-GC retiring stale or over-blocking rules, and the loop-audit.

## Gate fatigue is a waste signal

When gates fire often but change nothing — false positives accumulating, `skip` used reflexively, rejections ignored — the gate set has become over-processing. Treat rising false-positive rates and habitual overrides as data, not noise: they route to loop-audit, which tightens, retires, or re-scopes the offending gate. A gate nobody respects protects nothing and costs attention; retiring it is an improvement, not a loss.
