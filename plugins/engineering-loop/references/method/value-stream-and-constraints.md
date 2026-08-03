# Value Streams and the Theory of Constraints

## Sketch the value stream at Frame

Before executing anything, sketch where the time will go. A value-stream sketch for a run is a one-pass prediction: for each planned node, which phases involve active work, where the hand-offs are, and — critically — **where the waits will be**. Typical waits: CI queue and run time, human review latency, environment provisioning, data-pipeline runs reaching terminal state, approval checkpoints. Name each expected wait explicitly in the Frame output.

The sketch is not decoration. It drives three decisions: what to overlap (start polling CI on node 1 while executing node 2), what to batch (consecutive mechanical nodes through one gauntlet pass), and where the constraint is (see below). After the run, compare the sketch against the measured per-phase times in the metrics ledger — mispredicted waits are a Frame-phase learning.

## Flow efficiency

Flow efficiency = value-add time ÷ total lead time. In most engineering flows the number is brutally low — work spends most of its life waiting, not being worked. The corollary: optimising the active-work phases (typing faster, generating faster) attacks the small fraction; shrinking or overlapping the waits attacks the large one. When lead time must come down, look first at queues and hand-offs, not at execution speed.

## Theory of Constraints

Every system has exactly one binding constraint at a time — the resource whose capacity sets the throughput of the whole flow. Goldratt's discipline, applied to an agentic loop:

1. **Identify the constraint, per workload.** In agent-driven engineering the constraint is **usually human review attention**: the agent can produce diffs far faster than a human can responsibly review them. But verify per workload — for a data migration the constraint may be a pipeline's run window; for a modernisation, CI capacity across a large matrix.

2. **Exploit the constraint.** Make every unit of the constrained resource count. If review attention is the constraint: stacked atomic PRs (single reviewable mutation each), self-review and blind prosecution *before* the human looks, no residue, no undeclared scope — the reviewer spends attention on the change's substance, never on untangling it.

3. **Subordinate everything else to the constraint.** The loop's pace is the constraint's pace. Pull work into the constraint at the rate it drains, never push. Producing five unreviewed PR stacks while the reviewer processes one is not progress; it is inventory (partially-done work) that will rot and require rebasing — subordination means the agent sometimes idles or switches to constraint-relieving work (improving CI speed, pre-answering likely review questions) instead of producing more.

4. **Elevate only after exploiting.** Add reviewer capacity, parallelise CI, widen the pipeline window — but only after steps 2–3 are exhausted; elevating a badly exploited constraint wastes the investment.

5. **Repeat.** When the constraint moves, re-identify. A run that fixes review flow may next find CI is binding.

## Never add ceremony to non-constraints

An hour saved at a non-constraint is a mirage; an hour of ceremony added at a non-constraint is pure waste. Gates, panels, and evidence requirements earn their cost only where they protect throughput at or upstream of the constraint. Tightening checks on a phase that already has slack changes nothing except cost-of-method. When proposing a new gate (kaizen) or selecting a tier (Frame), ask where the constraint is: a blocking check on the non-constraint path is over-processing by definition, and loop-audit should retire it.
