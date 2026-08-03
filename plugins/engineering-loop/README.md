# engineering-loop

A self-learning, lean agentic engineering loop for Claude Code — for **any** workload: a new
feature, a bug fix, a refactor, a spike, a data migration, an infra change, or a platform
modernization.

It operationalises the disciplines that make human teams effective — tight feedback loops, lean
waste-elimination, agile incrementalism, and modern DevOps (stacked atomic PRs) — and it improves
itself: every defect is root-caused to *the gate that should have caught it*, and that gate is
updated so the same defect cannot recur.

Mined from a real, measured .NET 10 modernization (reaqtive/reaqtor PRs #155/#163/#165/#170):
4,540 file-changes, a 7-lens adversarial review of the process itself, and every revert traced to
its upstream cause. The canonical lesson — a performance idiom adopted because it *sounded* right,
shipped, challenged in review, then benchmarked slower and reverted — became the loop's spine:
**move evidence upstream**.

## Entry points (adopt incrementally)

| Command               | What it does                                           | Adoption rung    |
|-----------------------|--------------------------------------------------------|------------------|
| `/engloop-verify`     | Run the full verification gauntlet at real strictness  | 1 — start here   |
| `/engloop-prosecute`  | Refute-first adversarial review of any diff or plan    | 2                |
| `/engloop-plan`       | Produce an evidence-gated plan (advisory; you execute) | 3                |
| `/engloop <workload>` | Drive the full 7-phase loop                            | 4 — the capstone |

## The loop

**Frame → Plan (evidence gates) → Execute (stacked atomic slices) → Verify (inner + outer) →
Self-review (adversarial) → Reconcile (CI + PR polling) → Learn (kaizen + loop-audit)**

Right-sized by tier, per node: **Tier 0 Express** (trivial work: understand → change → verify,
near-zero ceremony), **Tier 1 Standard** (all phases, single-pass, gates advisory), **Tier 2
Full** (blind adversarial panel, mandatory pre-registered evidence, blocking hooks — forced by
any quality-attribute claim). Control surface: `skip`, `abort`, `handback`, `upshift`/`downshift`,
`why`, `--plan-only`.

## Architecture

- **Methodology layer** (this plugin, read-only): ~24 universal engineering truths → gates →
  practices. See `references/method/first-principles.md`.
- **Runtime context** (loaded on detection): `references/playbooks/*` (workload) ×
  `references/platforms/*` (stack) × `references/design-principles/*` (architecture class).
- **Mutable registry** (lives *outside* the plugin): prosecutor lenses and DoR checklists are
  data, not prompts. Seeds ship in `registry/`; learnings accrete in overlays at
  `~/.engineering-loop/registry/` (cross-repo) and `<repo>/.engineering-loop/registry/`
  (repo-local). Kaizen proposes; a human ratifies any relaxation.
- **Live loop state**: `<repo>/.engineering-loop/{work-graph.json, gates.json, metrics.jsonl,
  plans/, evidence/, intentional-decisions.md, kaizen-log.md, registry/ (project overlay),
  history/ (closed runs)}` — phases hand off through these files; hooks enforce gate verdicts;
  a SessionStart hook resumes interrupted loops.

## Integrity

The loop treats its own optimiser as the adversary (`references/method/threat-model.md`):
blind prosecution with structured verdicts, first-verdict-binds, calibration canaries, immutable
evidence pre-registration, tighten-only kaizen ratchet, untrusted outer-loop inputs, convergence
budgets, and human checkpoints that cannot be self-satisfied.

## Install

Add this directory as a plugin (or via a marketplace entry pointing at it). Requirements: `git`;
`jq` recommended for blocking hook enforcement (hooks fail open without it); `gh` for the outer
loop on GitHub.
