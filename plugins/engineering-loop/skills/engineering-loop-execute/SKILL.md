---
name: engineering-loop-execute
description: "This skill should be used for phase 3 of the engineering loop — executing planned nodes as stacked atomic changesets: declare scope, mutate, drift-audit, stack. USE FOR: implementing a planned node, creating a stacked PR slice, running the drift audit. DO NOT USE FOR: planning nodes (engineering-loop-plan), running the verification gauntlet (engineering-loop-verify), or ad-hoc edits outside a loop run."
---

# Phase 3 — Execute in stacked atomic slices

One atomic mutation per slice; a human reviewer must be able to reason about each slice in
isolation and spot drift instantly. WIP-capped pull: take the next ready node only when the
downstream constraint (usually review) has capacity — don't push a pile of half-done slices.

## Per-slice protocol

1. **Check the node's entry gates.** A claim-bearing node (`required_evidence: true`) may only
   be mutated if `gates.json` already holds its evidence verdict: PASS → build it; FAIL → the
   node is `killed`, build nothing (the only exception is a plan-recorded
   thinnest-slice-that-measures rule, which builds the minimal slice *to* measure). A Tier-2
   node additionally needs its plan-prosecution PASS on record. Evidence runs at Plan,
   pre-mutation — never "we'll benchmark it in Verify after building it all".
2. **Confirm the baseline** — right branch, up-to-date, and for external-state work the real
   system state matches the assumed baseline. Never stack on an unsquashed feature branch that
   main will squash — that is the whole-file-conflict landmine; re-baseline as main + additive
   delta instead (`references/method/devops-stacked-prs.md`).
3. **Re-state the declared scope** (from the locked plan) before touching anything.
4. **Mutate — only what is declared.** Rules that prevent the recurring reverts:
   - **Mechanical and semantic changes never share a slice.** An enabling refactor and a
     behaviour change are separate changesets; a formatting sweep never hides a logic edit.
   - **Templates, not outputs.** Generated code is changed by editing its template/source and
     regenerating; hand-editing generated output is drift.
   - **No residue.** Automated sweeps clean up after themselves — no comment-only husk files,
     no stray configs, no empty conditional blocks. Residue is part of the slice, not a
     follow-up.
   - **Sweep siblings.** Fixing a pattern once obliges finding its same-shaped siblings within
     the declared scope — a half-swept pattern is a hidden defect.
5. **Drift-audit before commit.** Compare the actual change against the declared scope:
   - Source changes: the staged diff.
   - External-state changes: the **previewed real mutation** — `terraform plan`, migration
     dry-run, `data-diff` — not just the source diff.
   Any out-of-scope change: stop, then either split it into its own slice or (advisory tiers)
   ask. At Tier 2 the PreToolUse hook blocks the commit mechanically; the
   `changeset-drift-auditor` agent provides the rich diagnosis. Auto-escalate the node one tier
   on drift — drift is a surprise.
6. **Commit + stack.** One slice per commit/PR, message stating intent and scope
   (`<node-id>: <intent>` for slices; `engineering-loop: state (<phase>)` for state commits).
   **No forge (no PR host)?** Slices land as an ordered commit sequence on the branch — the
   stack *is* the commit sequence; everything else is unchanged. Stacks compose a vertical
   slice; trunk stays releasable. No force-push or history rewrite without explicit human
   confirmation. Loop-state files are exempt from declared scopes and the drift audit and are
   committed separately at phase exits — **the router's state-commit rule is the canonical
   statement**; this line and `gate-check.sh` implement it.

## Caps

Respect per-slice caps (files/hunks) from `references/method/stacked-atomic-changesets.md`;
exceeding them needs a recorded semantic-cohesion justification. Splitting a genuinely coupled
change across slices to sneak under caps is itself a violation (anti-fragmentation).

## Exit gate

Node status → `executed` in `work-graph.json` with the drift verdict recorded in `gates.json`;
hand off to `engineering-loop-verify`.
