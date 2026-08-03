---
description: Drive the evidence-gated engineering loop over a workload (feature, bug, refactor, spike, migration, modernization)
argument-hint: "<workload description> [--plan-only] [--express|--full]"
allowed-tools: ["Read", "Write", "Edit", "Glob", "Grep", "Bash", "Task", "AskUserQuestion", "Skill", "TaskCreate", "TaskUpdate", "WebFetch"]
---

**Workload:** $ARGUMENTS

Drive this workload through the engineering loop. Load the `engineering-loop` router skill now
and follow it exactly; it defines the state contract, detection, tiering, and phase handoffs.

Execution contract:

1. **Arming check first:** verify `jq` is available (`command -v jq`). If absent, tell the
   user in one line that Tier-2 mechanical gates (commit blocking, Stop guard) are FAIL-OPEN
   and therefore advisory this run — the skills still enforce, but nothing blocks mechanically.
2. If `.engineering-loop/work-graph.json` exists in the repo with `run_status: "active"`,
   **resume**: report the state (nodes by status, standing checkpoint approvals, unmet gates)
   and continue from the graph's `next` pointer. **On resume the first-5-minutes contract is
   replaced by that report** — recorded checkpoint approvals survive session boundaries; do
   not re-demand the real-goal confirm. Otherwise start at phase 1 (`engineering-loop-frame`),
   where the first-5-minutes contract applies in full.
3. Honour the first-5-minutes contract: restated real goal (confirm inline) → tier + one-line
   why → plan-at-a-glance (≤5 bullets) → go. No wall of ceremony.
4. Flags: `--plan-only` stops after phase 2 — **including plan sign-off** — with the graph and
   gates displayed. `--express`
   forces Tier 0, `--full` forces Tier 2 — except a quality-attribute claim can never be
   downgraded below Tier 2 without an explicit, logged human accept-with-justification.
5. Honour the control surface at all times: `skip`, `abort`, `handback`, `upshift`,
   `downshift`, `why`.
6. Never self-satisfy the human checkpoints (full inventory in the router's state contract):
   plan sign-off, gate relaxation, reverts, resolution of human-opened threads.
