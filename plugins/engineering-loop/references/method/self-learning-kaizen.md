# Self-Learning: Kaizen and the Registry

A defect reveals a process gap. The kaizen phase root-causes every escape to the gate that should have caught it, and fixes the *process* — so the same defect class cannot recur — not just the instance. The mechanism is a mutable registry of lessons that the loop's prosecutors and checklists load at startup: the engine is fixed; the gate set is data.

## Registry architecture

Three layers, merged at load:

```
plugin seed:      ${CLAUDE_PLUGIN_ROOT}/registry/       (shipped defaults, read-only)
user overlay:     ~/.engineering-loop/registry/         (cross-repo learnings)
project overlay:  <repo>/.engineering-loop/registry/    (repo-local learnings)
```

Registry files, identical names in every layer: `lenses.yaml` (prosecutor lenses),
`plan-checklist.yaml` (Definition-of-Ready items), `lessons.yaml` (kaizen lesson records,
status `proposed` until ratified). Activation mechanics: a ratified lesson whose
`target_artifact` is a lens is rewritten as an entry in the *same overlay's* `lenses.yaml`
(lens schema: id/truth/question/reject_if/applies_when/status/source_lesson) — which the
prosecutors load on their next run. That rewrite is the moment a lesson becomes an active gate.
**Activation paths for the other target types:** `checklist` → an entry in the same overlay's
`plan-checklist.yaml` (carry `source_lesson`, same as lenses). `playbook` / `platform-pack` →
overlays cannot hold these; the ratified lesson stays in `lessons.yaml` with
`status: active` as a **standing advisory** (loaded and surfaced whenever that playbook/pack
is loaded) and doubles as a proposal for the plugin maintainer to fold into the pack at the
next release.

**Ratification QA (mandatory before activating):** validate the proposed rule text against the
*current* canonical schemas and docs — a lesson drafted mid-run can encode a stale or mistaken
reading (observed: a ratified checklist item asserting `prosecutor: plan|diff` when the canon
also allows `"self"`). A rule that contradicts the router's canonical contract must be
corrected at ratification or rejected; when a later canon change invalidates an active overlay
rule, gate-GC retires or amends it. The canon always wins over an overlay rule in conflict.

A plugin installs read-only, so self-learning must target data the engine loads, never the engine itself. Prosecutors own no rules of their own; they load the merged rule-set and apply the subset selected by each record's `applies_when` selectors. Selectors are the anti-poison mechanism: a `platform:dotnet` lens never fires on a Python run; a repo-local lesson never leaks into another repository.

**`applies_when` vocabulary** (empty object `{}` = universal): `platform` (a platform-pack name: `dotnet`, `node`, `python`, `dbt`, `terraform`, or a detection label like `bash` for platforms without a pack), `workload` (a playbook name: `new-feature`, `bug-fix`, `modernization`, `refactor`, `spike`, `performance`, `data-migration`, `ml-experiment`, `infra-change`, `data-incident` — the legal set is exactly the files in `references/playbooks/`), `phase` (`plan` | `diff` — which prosecution pass applies the lens), `architecture` (a design-principles pack name). Unknown keys are ignored with a warning, never silently matched.

## The lesson record

Every lesson is a structured record:

- `id` — stable identifier.
- `trigger` — the observable condition that fires the lens.
- `five_whys_root` — the root cause chain's terminus.
- `should_have_caught` — the gate (phase boundary) that should have stopped it.
- `universal_truth` — the one-line principle the lesson instantiates.
- `scope` — `repo-local` | `platform:<x>` | `universal`.
- `target_artifact` — which registry artifact the lesson updates on ratification: `lens` |
  `checklist` | `playbook` | `platform-pack` (the activation paths below route by this). What
  a resulting *lens* inspects is expressed in its `applies_when` (`phase: plan|diff|registration`).
- `proposed_change` — the concrete gate/lens/checklist edit.
- `applies_when` — selectors bounding where it fires.
- `occurrences`, `repos_seen` — recurrence evidence.
- `status` — `proposed` | `active` | `dormant` | `retired`.
- `activated_run` — when it went active (anchors the repeat-defect metric).
- `false_positives`, `last_fired` — health telemetry feeding gate-GC.

## The scope-promotion ladder

Every lesson **starts repo-local**. It promotes to `platform:<x>` only after recurring across ≥N repositories — one repo's convention is not a platform truth. It promotes to `universal` only if two conditions both hold: it is expressible as a first-principle truth in agnostic vocabulary, **and** it survives an adversarial generality challenge (a prosecutor actively hunting the platform where it is wrong). The ladder exists because premature generalisation is how gate sets rot: a lesson promoted too far fires as a false positive everywhere it does not apply.

## The kaizen ratchet

Registry edits are **append/tighten-only by default**. Kaizen may add a lesson, tighten a threshold, or extend a trigger without ceremony. **Any relaxation** — loosening, retiring, down-scoping a gate — **requires explicit human ratification**. Kaizen *proposes*; the human *commits*. After any registry edit, the regression suite (replaying historical defects) must still pass: a tightening that breaks the replay of an old catch is a regression in the gate set itself.

Memories and notes are dated, scoped, and **advisory — never sufficient to satisfy a gate**. "A memory says this is fine" is not evidence; only the gate's own criteria satisfy the gate.

## Gate-GC

The gate set must itself stay lean; an unbounded, append-only rule-set becomes over-processing. Records decay through `active → dormant → retired`: a lens that has not fired within its staleness window goes dormant; one accumulating false positives beyond bound, or superseded by a broader lesson, is proposed for retirement. Retirement is a relaxation and therefore requires human ratification — but *proposing* it is gate-GC's job, run at loop-audit.

## Andon

Kaizen is **andon-triggerable mid-loop**, not only at the run's end. Any agent, or the human, can stop the line on spotting a recurring defect class: the loop pauses, the 5-whys runs now, the lesson lands in the registry now — so the very next node benefits. Batching lessons to a retrospective lets the same defect recur within the run that discovered it.

## The triple loop

Periodically, **LOOP-AUDIT** audits the auditor. It reads the metrics ledger and asks: are gates catching (repeat-defect trending to zero)? are they precise (false-positive rate bounded)? is the promotion ladder calibrated (universals surviving challenge; platform lessons actually recurring)? It runs gate-GC, retires stale rules, and tunes kaizen itself — thresholds for promotion, staleness windows, N-repo requirements. Single loop fixes the defect; double loop fixes the gate; triple loop fixes the gate-fixer.

## Worked example: 5-whys to the gate

The frozen-collections defect, prosecuted properly:

Frozen collections were adopted in a modernisation; review challenged the claim; benchmarks then measured them 1.18–1.24× *slower* on the actual small, reference-type-keyed tables; the change was reverted.

1. Why was it reverted? — It was measurably slower.
2. Why did it ship slower? — It was adopted without measurement.
3. Why no measurement? — "Newer, purpose-built collection" *sounded* faster; the claim felt self-evident.
4. Why did a felt claim reach execution? — The plan contained a quality-attribute claim ("faster lookups") with no pre-registered validation.
5. Why did the plan pass? — **No gate prosecuted quality-attribute claims for evidence at Plan exit.** ← the gate that should have caught it.

Resulting record: trigger = "plan or diff asserts a quality attribute (faster/smaller/safer/cheaper) with no pre-registered evidence"; `should_have_caught` = Plan-exit prosecution; `universal_truth` = "'Better' is a hypothesis, not a fact"; `scope` = universal (it is a first-principle and survives generality challenge); `proposed_change` = any quality-attribute claim forces Tier 2 with mandatory pre-registered evidence. The validation that happened *as a reaction to review* now happens *as a condition of planning* — evidence moved upstream, which is the loop's spine. After activation, repeat-defect for this class must read zero, forever; anything else is priority kaizen on the gate.
