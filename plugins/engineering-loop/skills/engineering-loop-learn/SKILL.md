---
name: engineering-loop-learn
description: "This skill should be used for phase 7 of the engineering loop — kaizen: root-causing every course-correction to the gate that should have caught it, emitting structured lesson proposals to the registry overlays, updating the metrics ledger, and periodically auditing the gate set itself (loop-audit). USE FOR: \"run kaizen\", post-run retrospective, an andon stop mid-loop, proposing a new prosecutor lens, the periodic loop-audit. DO NOT USE FOR: fixing the defect itself (that already happened upstream), editing the plugin's seed registry (forbidden — overlays only), or general retrospectives outside a loop run."
---

# Phase 7 — Learn / kaizen (and 7b — loop-audit)

A defect reveals a process gap. This phase turns every course-correction into a durable,
*active* rule — and keeps the rule set itself lean. Andon-triggerable mid-loop: a recurring
failure class does not wait for the retrospective.

## Kaizen protocol (per correction: revert, reviewer catch, escaped defect, gate near-miss)

1. **5-whys to the gate.** Root-cause not to the code but to *the gate that should have caught
   it*. Worked example: frozen collections reverted → why? benchmark showed slower → why
   shipped? adopted on idiom → why unchecked? no evidence gate fired → **the gate**: any
   quality-attribute claim requires pre-registered validation at Plan.
2. **Emit a structured lesson record** (status: `proposed`) appended to the appropriate
   overlay's `registry/lessons.yaml` (`<repo>/.engineering-loop/registry/lessons.yaml` for
   repo-local; `~/.engineering-loop/registry/lessons.yaml` only on promotion). Schema per
   `references/method/self-learning-kaizen.md`: id, trigger, five_whys_root,
   should_have_caught, universal_truth, scope, target_artifact (lens | checklist | playbook |
   platform-pack), proposed_change, applies_when, occurrences, status. A ratified lesson whose
   target is a lens becomes an entry in that same overlay's `lenses.yaml` (same schema as the
   seed) — that is the mechanism by which a lesson fires on the next run.
3. **Scope honestly.** Every lesson starts `repo-local`. Promote to `platform:<x>` only after
   the signature recurs across repos; to `universal` only if expressible as a first principle
   AND it survives an adversarial generality challenge. `applies_when` selectors are the
   anti-poison mechanism — a dotnet lesson must never fire on a Python run.
4. **The ratchet.** Kaizen **proposes; the human commits.** Appends and tightenings may
   activate with sign-off; *any* relaxation, retirement, or loosening of an existing gate
   requires explicit human ratification — the loop must not be able to lobotomise its own
   gates under convergence pressure. Memories/lessons are advisory context, never sufficient
   to satisfy a gate. After any registry change, replay the historical-defect regression set.
5. **Close out the metrics** (`references/method/measurement.md`): emit the closing events to
   the ledger (events only — the ledger never stores derived numbers) and report the computed
   rollups (lead time, rework, escaped-defect vs gate-catch, first-pass yield, cost-of-method)
   in `kaizen-log.md`. Also record what the process *wasted* this run (`waste-hunter`
   findings): over-processing, waiting, handoffs.

## 7b — Loop-audit (the triple loop; periodic, not per-run)

Audit the gate set against the metrics ledger:
- **Are gates catching?** Repeat-defect count after a gate's activation is the killer metric —
  >0 means the gate failed; it re-enters kaizen as priority.
- **Are gates precise?** False-positive/over-block rate bounded; a lens that never fires is
  theatre — candidate for retirement; one that fires late is a shift-left target.
- **Is promotion calibrated?** Universal gates later retired as overfit → raise the promotion
  threshold.
- **Gate-GC:** propose `active → dormant → retired` transitions (human-ratified) for stale,
  superseded, or over-blocking rules. A monotonically growing gate set is itself lean waste.
- **Tune kaizen itself** — root-cause quality, promotion thresholds, andon sensitivity.

**Zero corrections AND zero escapes is a legal outcome:** file no lessons (filing filler is
evidence theatre), still run waste-hunter, and record the `kaizen-ratification` checkpoint as
"nothing to ratify" so the phase's completion is on the record. **A bug fixed this run counts
as a pre-run escaped defect** — its 5-whys lesson (per the bug-fix playbook) is in scope even
when the run itself had no corrections; the two rules are complementary, not in conflict.

## Exit — closing the run

Lessons filed, metrics written, proposals presented for ratification, `kaizen-log.md` appended.
Then **close the run**: set `run_status: "closed"` in `work-graph.json` (every node in a
terminal status — `done`, `killed`, or `blocked`-with-a-recorded-human-decision). A run is not
closed until this phase has run — learning is not optional ceremony; it is the mechanism by
which the next run is cheaper. The SessionStart resume hook reports a closed run briefly as history
(it never offers to resume it); a new `/engloop` invocation starts a fresh run alongside the
history.
