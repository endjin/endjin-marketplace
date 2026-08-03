# Measurement: Instrumenting the Loop

Companion to [flow-metrics.md](flow-metrics.md), which defines *what* is measured. This reference defines *how* the numbers arrive and how they are used honestly.

## How phases emit events

Every phase boundary emits events as JSON lines appended to `.engineering-loop/metrics.jsonl` (loop state, not the rule registry) — **full schema — including the event and canonical phase-token enumerations — is defined in
flow-metrics.md and governs**; the tuple is `{ts, run, node_id, event, phase, gate_id?, detail}`
(`run` is the same field name as gates.json records; `phase` tokens: `frame`, `plan`,
`execute`, `verify`, `self-review`, `reconcile`, `learn`). Emission is a phase-exit responsibility from **Frame onward** (the frame skill's exit is the first emission), not an afterthought: a phase that exits without emitting has not exited. Key emissions:

- `phase_exit` per node (**mandatory** — the emission that defines a phase as exited);
  `phase_enter` is **optional** (emit when entry and exit are far apart and wait-time matters).
  Any run-level phase or fact (Frame, Learn, run-level verdicts) uses `node_id: null`. From
  these, lead time and per-phase process time derive. **Closing events** at Learn = the
  `phase_exit` for `learn` plus one `gate_verdict` per any verdict recorded during closure —
  nothing more is mandated.
- `gate_verdict` — one event per verdict appended to `gates.json`, whatever the outcome
  (PASS/FAIL/ABSENT/…); `gate_fire`/`gate_pass`/`gate_reject` remain the enforcement-outcome
  events. Neutral facts (e.g. `ci: ABSENT`) are `gate_verdict`, never a stretched `gate_pass`.
  **`gate_id` is always the gates.json `gate` value** (`prosecution`, `drift`, …); the
  specific lens that fired goes in `detail.lens_id`.
- `gate_fire`, `gate_pass`, `gate_reject` — with `gate_id`, from which gate-catch and false-positive rates derive (a rejection later judged wrong is amended by a follow-up event, never by editing history).
- `rework` when a node re-enters a phase it exited; `revert` always counts as rework.
- `escape` when a defect is caught downstream of the phase that should have caught it, tagged with where it was caught and where it should have been.
- `override` for every `skip`, tier down-shift, or accept-with-justification.

The file is append-only. Derived numbers are computed from the log at read time; nothing is stored back edited. An append-only ledger cannot be retrofitted to flatter the method.

## How kaizen consumes rollups

Kaizen and loop-audit read rollups, not raw lines:

- **Repeat-defect after activation** joins `escape` events against lesson records' `activated_run`: any escape matching an active lesson's trigger class, after activation, increments the killer metric and fires priority kaizen *on the gate*.
- **Gate health** rolls `gate_fire` / `gate_reject` / false-positive amendments per `gate_id` into the `false_positives` and `last_fired` fields of the lesson record — the inputs to gate-GC.
- **Waste hunting** reads phase-time and rework rollups to name the dominant waste per run, feeding the next kaizen cycle with data rather than anecdote.
- **Promotion evidence**: `occurrences` and `repos_seen` on lesson records are maintained from events, so ladder promotion is claimed from the ledger, not from memory.

## Verification tests

The self-learning claim is itself a hypothesis; these are its falsification conditions:

1. **Repeat-defect = 0 after gate activation.** Replay the original defect (or its class) against a run where the lesson is active: it must be caught at the gate named in `should_have_caught`. Any repeat after activation fails the test — the gate, not the world, is then the defect.
2. **Overlay persistence across runs.** A lesson learned in run N must fire as an active gate in run N+1 with **no edit to the plugin package** — proving the overlay registry, not the session's context, carries the learning. A lesson that only lives in conversation memory has not been learned.
3. **Forward efficacy, not retrodiction.** Retrodicting old defects the gates were built from proves only that the gates encode their own history — retain it solely as a smoke test. The real test is forward: across ≥N new nodes, after a kaizen gate update, the targeted defect class measurably drops while throughput holds and false positives stay bounded. Improvement is claimed from that trend or not at all.
