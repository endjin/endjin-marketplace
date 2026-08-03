# Flow Metrics: The Loop Measures Itself

"We are improving" is a hypothesis, and like every hypothesis in this method it must be evidenced. The flow-metrics ledger is that evidence. A process that is not measured cannot improve; a self-learning claim that is not measured is marketing.

## The ledger

Track, per run and rolled up across runs:

- **Per-node lead time** — clock time from node ready to node done (verified, merged). The customer-visible number.
- **Per-phase process time** — active work time inside each phase. The gap between lead time and process time is waiting; that gap is where waste hides.
- **Flow efficiency** — value-add time ÷ total lead time. Typical unmanaged flows run under 15%; the point of measuring is to see the waits, not to feel good.
- **Rework rate** — nodes re-entering a phase they had exited. **Every revert counts.** A revert prompted by review is rework that a Plan-exit gate failed to prevent.
- **Escaped-defect rate** — defects caught downstream (CI, human review, production) versus at source (plan prosecution, local gauntlet, drift-audit). Shift-left succeeds when this trends toward source.
- **Gate-catch rate** — defects stopped by a gate before they escaped. Rising catch rate with stable throughput means the gates are earning their cost.
- **Repeat-defect count after gate activation** — **the killer metric.** Once a kaizen lesson activates as a gate, the defect class it targets must never recur. Any value above zero means the gate failed at its only job: it fires priority kaizen on the gate itself, not another instance-fix.
- **Gate false-positive rate** — rejections that were wrong. Bounds the cost of vigilance; feeds gate-GC.
- **Review-cycle count** — round-trips per PR before merge. The constraint (human review attention) is spent here; minimise cycles, not review depth.
- **First-pass yield** — nodes exiting Verify with no rework. The single best summary of upstream quality.
- **Cost-of-method** — time and tokens spent on the loop's own ceremony (panels, prosecution, polling). The method is over-production the moment this exceeds the waste it removes.

## Little's Law and WIP limits

Little's Law: **L = λW** — average work-in-progress equals arrival rate times average lead time. Rearranged: **W = L / λ**. Lead time is directly proportional to WIP at a given throughput. This is why WIP limits are not a preference but the control lever: cutting WIP is the only way to cut lead time without changing the work itself. Pull, don't push — especially into the constraint (usually human review attention). A loop that starts ten nodes finishes none faster; it finishes all slower and multiplies task-switching waste.

## Event schema

Phases emit events as JSON lines appended to `.engineering-loop/metrics.jsonl` (loop state, not the rule registry):

```json
{"ts": "2026-08-01T14:32:07Z", "run": "r-0042", "node_id": "n-03", "event": "gate_verdict", "phase": "plan", "gate_id": "evidence", "detail": "PASS on second attempt; lens_id in gates.json detail"}
```

Fields: `ts` (ISO 8601 UTC), `run` (same field name as gates.json records — one vocabulary
across both ledgers), `node_id` (null for run-level phases), `event`
(`phase_enter`, `phase_exit`, `gate_verdict`, `gate_fire`, `gate_pass`, `gate_reject`,
`rework`, `revert`, `escape`, `override`, `amend` — a follow-up event correcting one or more
earlier mis-emissions, citing each corrected event's `ts` in `detail`; history is never
edited), `phase` (canonical tokens: `frame`, `plan`,
`execute`, `verify`, `self-review`, `reconcile`, `learn`), `gate_id` (only on gate events;
always the gates.json `gate` value — lens ids go in `detail`), `detail` (free text, one line).
Event rules: `gate_verdict` fires once per verdict appended to `gates.json`, whatever the
outcome — **the DRIVER emits it**, even when the verdict was written by a spawned subagent
(subagents write `gates.json`; the driver owns the metrics ledger); checkpoints are not
verdicts and get no `gate_verdict`. `gate_pass`/`gate_reject` fire **additionally** only when
a gate mechanically enforced (blocked or admitted an action at Tier 2) — advisory verdicts
emit `gate_verdict` alone. Append-only; rollups are computed, never stored back edited.

## The honesty rule

The self-learning claim is true **only if** repeat-defect trends to zero and gate-catch rises while false-positive stays bounded. All three, together. Rising catch rate with rising false positives is a gate set becoming noise; zero repeat defects with falling catch rate means defects are escaping unmeasured. Loop-audit reads exactly these three trends and nothing softer.
