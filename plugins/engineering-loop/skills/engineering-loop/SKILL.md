---
name: engineering-loop
description: "This skill should be used when driving the evidence-gated engineering loop over a workload — after /engloop is invoked, when the user asks to \"run the engineering loop\", \"use the loop methodology\", \"evidence-gated development\", or when resuming a loop whose state exists in .engineering-loop/. ROUTER ONLY — it detects context, establishes state, and routes to the engineering-loop-* phase skills. DO NOT USE FOR: recurring-interval tasks (that is the separate 'loop' skill), one-off builds or tests (use engineering-loop-verify or run the command directly)."
---

# engineering-loop (router)

Drive any workload — feature, bug fix, refactor, spike, migration, modernization — through a
lean, evidence-gated, self-learning loop. This router establishes context and state, then routes
to the phase skills. It performs no phase work itself.

## The loop at a glance

| # | Phase | Skill | Exit gate |
|---|---|---|---|
| 1 | Frame & map | `engineering-loop-frame` | Real goal confirmed; work-graph + tiers recorded |
| 2 | Plan (evidence gates) | `engineering-loop-plan` | DoR met per node; Tier-2 plans survive prosecution |
| 3 | Execute (stacked slices) | `engineering-loop-execute` | Each slice: diff == declared scope |
| 4 | Verify (inner + outer) | `engineering-loop-verify` | Gauntlet green; evidence executed; CI terminal-green |
| 5 | Self-review | `engineering-loop-review` | Diff-prosecution survived |
| 6 | Reconcile | `engineering-loop-review` | Threads resolved / budget → human escalation |
| 7 | Learn / kaizen | `engineering-loop-learn` | Lessons + metrics recorded; proposals filed |

Phases hand off **through the state files**, never through conversational memory.

## State contract (read before doing anything)

All live state lives in `<repo>/.engineering-loop/` (commit it — the state and project overlay
must persist across sessions). **State-commit rule (applies from Frame onward, every phase):**
at each phase exit, commit the state changes as a separate `engineering-loop: state (<phase>)`
commit — never mixed into a production slice; state files are exempt from declared scopes:

- `work-graph.json` — `{run_id, workload (the verbatim ask), real_goal (the confirmed
  restatement), run_status: "active"|"closed", next: {node, phase}, nodes: [...]}`.
  **`run_id` minting rule:** `r-NNNN`, zero-padded, monotonic — the first run in a repo is
  `r-0001`; a new run takes the highest id found in the live graph and `history/` plus one.
  **Starting a new run over closed history:** first snapshot the closed graph to
  `history/<old-run_id>/work-graph.json`, then write the fresh graph at the live path;
  `gates.json` and `metrics.jsonl` are shared append-only ledgers across runs (their records
  carry `run`); `plans/` and `evidence/` accumulate (node ids are **repo-unique across runs**
  — continue the `n-NN` numbering, never reuse). **`next` is the machine-readable resume
  pointer** — every phase exit updates it (the phase that just finished writes which
  node+phase comes next), so resuming never depends on parsing prose or metrics free-text.
  **`next.phase` uses exactly the canonical phase tokens** (`frame`, `plan`, `execute`,
  `verify`, `self-review`, `reconcile`, `learn` — the same list as the metrics ledger).
  `next.node` is **null for run-level phases** (`{node: null, phase: "learn"}`); phases 5–6
  are node-scoped while node work remains, run-level otherwise; at run closure Learn writes
  **`next: null`** (nothing follows a closed run). **`next` is the
  authoritative resume algorithm**; "first incomplete node in graph order" is only the
  fallback when `next` is absent or stale (points at a terminal node). Per
  node — **this field list is canonical; phase skills describe subsets of it**:
  `{id, intent, change_class, risk, reversibility: "one-way"|"two-way",
  blast_radius, tier (a JSON **number**: 0|1|2 — never a string), required_evidence,
  declared_scope: {files[], rationale},
  tier_reason (the one-line why for the tier),
  edges: [{type: "must-precede"|"depends-on", node}], status}`.
  (`change_class` lives at node level only — the scope inherits it; no duplicate to diverge.)
  **Edge direction, read from the owning node X:** `{type: "must-precede", node: T}` = X runs
  before T; `{type: "depends-on", node: T}` = T runs before X. (The two types are inverse
  conveniences; use whichever reads naturally, never both for one pair.)
  **Node status enum (only these):** `pending → planned → executing → executed → verified →
  done`, or terminal `killed` (evidence-failed) / `blocked` (escalated to human). `executing`
  is a working-tree-only status (set when a slice starts, superseded by `executed` before the
  phase-exit state commit) — it never appears in a committed state file; the commit-time hook
  still sees it because hooks run against the working tree.
  Ownership of transitions: Frame→`pending`, **Plan→`planned`**, Execute→`executing/executed`,
  Verify→`verified`, **Reconcile exit→`done`**, evidence-FAIL→`killed`, escalation→`blocked`.
  **Node flow is one-piece by default, through Reconcile:** a node reaches `done` (phases 3–6
  complete) before the next node executes; only the documented mechanical-batching rule may
  group nodes through shared phase passes (and edges always win).
- `gates.json` — **the ONE canonical verdict store** (this schema wins over any phrasing
  elsewhere; `scripts/gate-check.sh` enforces exactly this shape):
  `{"verdicts": [...], "checkpoints": [...]}` where every verdict record is
  `{run, node, gate: "prosecution"|"evidence"|"drift"|"gauntlet"|"ci"|"review",
  prosecutor: "plan"|"diff"|"self"|null,
  verdict: "PASS"|"REJECT"|"FAIL"|"UNTESTABLE"|"GREEN"|"RED"|"STALLED"|"NO_RUNS"|"ABSENT"|"RESOLVED"|"OPEN"|"ERROR",
  detail: {...}, timestamp}` — appended to `.verdicts[]`, never clobbered. **`node` is
  nullable** for run-level facts (e.g. repo-wide `ci: ABSENT`). **`prosecutor`, precisely:**
  `"plan"`/`"diff"` for spawned prosecutions; `"self"` for ANY unspawned Tier-1 self-pass
  (self-review AND self-audited drift); `null` for everything else — machine/observation
  gates (gauntlet, ci, review, evidence-designer runs) **and spawned non-prosecution
  auditors (`changeset-drift-auditor` writes `null`, per its file)**. `"ABSENT"` records an outer-loop signal that does not exist (no CI configured) —
  distinct from `NO_RUNS` (CI exists but was not triggered). Human checkpoint approvals append
  to `.checkpoints[]` as `{run, checkpoint, node?, decision, timestamp}` using the **canonical
  checkpoint ids**: `real-goal-confirm`, `detection-confirm`, `plan-sign-off` (recorded **per
  node**, `node` set), `gate-relaxation`, `revert-approval`, `thread-resolution`,
  `kaizen-ratification`. `decision` is free text; the reserved token `pending-human` parks a
  checkpoint no human could answer.
  **Checkpoint approvals are valid for the whole run and survive session boundaries** — on
  resume, report standing approvals and continue; do not re-demand them.
- `plans/<node-id>.md` — the per-node plan artifact (what the blind prosecutor receives).
- `intentional-decisions.md` — the reviewer-facing record of deliberate choices (written by
  self-review; goes in the PR description when a PR exists).
- `evidence/<node-id>/` — validation artifacts: pre-registered designs (registered BEFORE
  execution; hash recorded in the evidence verdict) and recorded observations (e.g. a bug
  fix's red→green record — an evidence *artifact*, not the evidence *gate*).
- `metrics.jsonl` — the flow-metrics event stream (phase entries/exits, gate events).
- `kaizen-log.md` — appended lessons; feeds the registry overlays
  (`registry/lessons.yaml` in the overlays).

If `work-graph.json` exists on entry with `run_status: "active"`: report the resume state
(nodes by status, standing checkpoints, unmet gates) and continue **from the graph's `next`
pointer** (fallback: first incomplete node in graph order) — do not restart. A `closed` run is
history, not a resume target — start a new run.

The mutable rule registry (lenses, checklists) merges three locations, most specific last:
`${CLAUDE_PLUGIN_ROOT}/registry/` (seed) ← `~/.engineering-loop/registry/` (user) ←
`<repo>/.engineering-loop/registry/` (project). Filter entries by `applies_when` against the
detected platform/workload. Never edit the seed; kaizen appends to overlays only.

## Detection (run at Frame; confidence-scored, confirmed with the human)

| Signal | Detect via | Load |
|---|---|---|
| Shell/bash | `*.sh` sources + a test script, no other platform signal | agnostic defaults (platform label `bash`; no pack — Verify's fallback gauntlet applies) |
| .NET | `*.sln`/`*.slnx`/`*.csproj`, `global.json` | `references/platforms/dotnet.md` |
| Node | `package.json`, lockfiles | `references/platforms/node.md` |
| Python | `pyproject.toml`, `requirements*.txt` | `references/platforms/python.md` |
| dbt | `dbt_project.yml` | `references/platforms/dbt.md` |
| Terraform/IaC | `*.tf`, `*.bicep` | `references/platforms/terraform.md` |
| CI system | `.github/workflows/`, `azure-pipelines.yml` | CI recipes inside the platform pack |
| Workload type | the user's ask + repo evidence | `references/playbooks/<type>.md` |
| Architecture class | public API? distributed? batch pipeline? | `references/design-principles/<class>.md` |

Emit confidence + supporting evidence; low confidence → use agnostic defaults and ask. Never
guess silently — wrong context is worse than no context.

## Tiering (the loop is a dial)

Per node, chosen at Frame, stated in one line, overridable with one token:
- **Tier 0 Express** — trivial/reversible: understand → change → verify. No graph, no panel.
- **Tier 1 Standard** — default: all phases single-pass; gates advisory (warn and ask).
- **Tier 2 Full** — high risk/blast-radius, or **any quality-attribute claim** (forced,
  non-negotiable): blind N-up prosecution, mandatory pre-registered evidence, blocking hooks.

Escalate mid-flight on surprise. Details: `references/method/right-sizing.md`.

## Control surface (honour at every phase)

`skip` (logged accept-with-justification) · `abort` (summarise, leave inspectable) ·
`handback` (human takes over with full context) · `upshift`/`downshift` · `why` (explain the
gate + cheapest satisfying action) · `--plan-only` (stop after Plan). Every gate rejection
states: what failed → why it matters (one-line truth) → cheapest next action.

## Handoff rules

1. Complete a phase by writing its outputs to the state files, then read the next phase's skill.
2. Spawn prosecutors/watchers as subagents per their agent definitions; they persist verdicts to
   `gates.json` — never accept a verbal verdict, and never re-roll a panel on an unchanged artifact.
3. The human checkpoints that can never be self-satisfied: plan sign-off, any gate relaxation,
   any revert/force-push, resolution of any human-opened review thread. **When no human is
   reachable, the legal move is to park**: record the checkpoint as `pending-human`, set the
   affected node `blocked`, and stop or continue with other nodes — never self-approve.
4. Method references under `references/method/` are the authority for each mechanism; load them
   on demand, not up front. Universal truths: `references/method/first-principles.md`.
