# First principles: the universal truths

The method separates three strata. A **truth** is a falsifiable claim about reality. A **gate** is the enforced check the truth generates. A **practice** is how a platform or workload passes the gate. Truths never change; gates live in the registry and evolve; practices arrive via runtime packs. Truths use agnostic vocabulary — "unit of change", "proxy signal", "baseline" — and platform packs translate ("commit/branch/PR" for git). Prosecutor lenses derive 1:1 from Plan-phase truths.

## A. Empiricism (knowing)

**1. "Better" is a hypothesis, not a fact.** Quality claims need pre-registered falsification conditions measured on the real system; evidence that cannot fail is not evidence. *Gate:* evidence pre-registration (Plan exit). *Example:* "FrozenDictionary is faster" must name metric, workload, and threshold before conversion — benchmarked, it was 1.18–1.24× slower.

**2. Distrust a result that flatters you.** Interrogate surprising *and* convenient results; understand why, not just the number. Truths 1 and 2 are the two halves of empiricism. *Gate:* convenient-result interrogation (Verify). *Example:* a migration diff showing zero row changes demands "why zero?" before sign-off.

**3. A passing proxy is not a succeeding outcome.** "It builds" ≠ "it works"; verify the real outcome under real conditions across the risk-relevant matrix — exhaustive is impossible, convenient-subset is negligent. For data: correct-at-sample ≠ correct at scale and skew. *Gate:* run-it / risk-matrix gate (Verify). *Example:* retargeted archive code compiled cleanly but threw `PlatformNotSupportedException` at run time.

**4. Trust in a variable world is statistical.** Where outcomes are non-deterministic or data-dependent, validate distributions — CIs, guardrails, holdout/shadow — not one green run. *Gate:* statistical-evidence gate (Verify). *Example:* an ML model change needs a holdout delta with confidence bounds, not one lucky eval.

**5. You can only manage what you can observe.** Define how success and failure will be observed *before* shipping; observability is the precondition of every other truth. *Gate:* observability-defined gate (Plan, DoR). *Example:* a new pipeline ships with row-count and freshness monitors defined in the plan.

## B. Change discipline (acting)

**6. A change is atomic, reversible where possible, and contains only what it declares.** Undeclared scope is unreviewable risk; one intent per unit of change, isolated and traceable. *Gate:* scope-drift audit (Execute, commit-time). *Example:* a staged file outside declared scope blocks the commit.

**7. Prefer two-way doors; spend scrutiny in proportion to irreversibility.** Classify every node one-way/two-way; effects that mutate external state or delete data are presumed irreversible until a reversal path is *engineered*. Data cannot be unshipped — plan forward-fix where revert is impossible. *Gate:* reversibility classification (Frame/Plan). *Example:* a `DROP COLUMN` runs expand/contract, never in the code-change slice.

**8. Know the blast radius before you act; make it as small as the change allows.** Bound what the change can touch before touching it. *Gate:* blast-radius declaration (Plan, DoR). *Example:* an IAM policy edit lists which principals gain or lose access before apply.

**9. Preview the real mutation before committing it.** Where the effect lives in an external system, review the concrete diff before apply. *Gate:* preview gate — plan/dry-run/data-diff (Execute). *Example:* `terraform plan` output is the reviewed artifact, not the HCL alone.

**10. Re-running must be safe.** Anything retried, resumed, or backfilled must converge; design for resume, not restart. *Gate:* idempotency/replay gate (Plan + Verify). *Example:* a backfill job re-run over the same partition produces identical output.

**11. Automation amplifies error as well as correctness.** Bound every bulk transform; prove one instance safe before scaling; behaviourally verify, never trust a fixer. *Gate:* bulk-transform behavioural check (Verify). *Example:* the MSTEST0049 auto-fixer silently switched method overloads — caught only because tests asserted traces.

**12. Working complex systems grow from working simple ones** (Gall). Evolve via slices; no big-bang never validated at small scale. *Gate:* thin-slice decomposition (Plan). *Example:* a warehouse migration cuts over one consumer, observes, then fans out.

## C. Causation

**13. Address the cause, not the symptom.** Two honest responses to a signal: fix the root, or accept-with-justification; silencing is worse than ignoring. *Gate:* honest-binary gate (Execute/Self-review). *Example:* reshaping code purely to stop an analyzer firing, leaving its complaint intact, is rejected.

**14. A defect reveals a process gap.** Root-cause every escape to the gate that should have caught it; fix the process, not just the instance. Truth 13 operates at object level, 14 at meta level. *Gate:* root-cause-to-gate kaizen (Learn). *Example:* an escaped perf regression produces a new registry lens, not just a patch.

**15. Don't tear down a fence until you know why it's there** (Chesterton). Respect existing intent; never restructure deliberate design to satisfy a mechanical rule. *Gate:* intent-check before restructure (Plan, idiom allow/deny). *Example:* multi-namespace files deliberately grouping related types stay block-scoped rather than being split.

**16. Every observable behaviour will be depended on by someone** (Hyrum). Any observable change is a breaking-change candidate; enumerate consumers — lineage, contracts — before changing an interface or a column's meaning. *Gate:* consumer-enumeration gate (Plan). *Example:* renaming a column requires a lineage query of downstream models first.

## D. Feedback

**17. Feedback is cheapest at the source.** Shift every check to the earliest phase boundary; primary enforcement is Plan-exit prosecution, not late review. *Gate:* Plan-exit prosecution (Plan). *Example:* a perf claim is challenged at planning, not in PR review after the code ships.

**18. A feedback loop only exists if you close it.** Actively poll machine and human signals to terminal state; for long-lived systems, deployment *starts* a standing loop (monitors, drift, cost). *Gate:* loop-closure gate (Review/Reconcile). *Example:* CI is polled to a terminal state on the exact head SHA — "probably green" is not a state.

**19. A process you don't measure can't improve.** The loop tracks its own flow and quality metrics; "we are improving" is a hypothesis like any other. *Gate:* flow-metrics ledger (Learn). *Example:* repeat-defect count after a gate activates must trend to zero, or the gate failed.

## E. Intent & governance

**20. Solve the real problem, not the literal ask.** Restate the goal and confirm it before work begins; the literal request may name a means, not the end. *Gate:* real-goal confirmation (Frame). *Example:* "ensure the archived tests run" actually meant "make the archive open quietly in the IDE".

**21. No tool is right everywhere.** Every adoption needs an explicit boundary of where it stops — allow/deny plus exclusion criteria; there are no silver bullets. *Gate:* idiom-boundary gate (Plan). *Example:* frozen collections win on large string-keyed tables and lose on small reference-keyed ones; the boundary is part of the adoption.

**22. Decisions are durable assets; artifacts have provenance.** Capture rationale (ADRs, memories) and derived-artifact lineage (inputs, code, params) so nothing is re-litigated and everything is reproducible. *Gate:* decision-capture gate (Learn). *Example:* a benchmark verdict is written into code comments and memory so the losing option is never re-proposed cold.

**23. Insert the decision before the cost is sunk.** The human steers at cheap decision points; past effort is not evidence of present value — judge reverts on current evidence. *Gate:* human checkpoint at plan sign-off (Plan exit). *Example:* a week of conversion work does not argue against reverting when the benchmark says revert.

**24. Speculative work is waste until proven needed** (YAGNI). A future need is an unvalidated hypothesis. Corollary flow truths: limit WIP, pull don't push, and anyone can stop the line. *Gate:* YAGNI/WIP gates (Frame/Plan). *Example:* a "we might need multi-region later" abstraction is deferred until the need is evidenced.
