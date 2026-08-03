---
description: Refute-first adversarial review of a diff or plan — blind prosecution against the lens registry
argument-hint: "[what to prosecute: a plan file, PR number, branch, or \"working diff\" (default)]"
allowed-tools: ["Read", "Glob", "Grep", "Bash", "Task"]
---

**Target:** $ARGUMENTS (default: the current working diff against the merge base)

Prosecute the target adversarially, standalone — no loop state required.

1. Assemble the artifact: a plan document, `git diff` output, or `gh pr diff <n>`. For
   external-state changes include the previewed real mutation (terraform plan / dry-run /
   data-diff) where available.
2. Load the merged lens registry: `${CLAUDE_PLUGIN_ROOT}/registry/lenses.yaml` overlaid by
   `~/.engineering-loop/registry/lenses.yaml` and `<repo>/.engineering-loop/registry/lenses.yaml`
   (most specific wins), filtered by `applies_when` against the detected platform. Plan targets
   use the plan lenses; diffs additionally use the diff lenses (drift, prove-not-quiet,
   sibling-sweep).
3. Spawn the matching prosecutor agent (`plan-prosecutor` or `diff-prosecutor`) **blind**: it
   receives the artifact + the lens criteria — never the author's rationale or this
   conversation's context. Follow `references/method/adversarial-review-protocol.md`.
4. Report findings ranked by severity. Every REJECT must cite the lens id and quote the exact
   artifact text that violates it — findings without a citation are void and must be dropped.
   For each finding: what failed → why it matters (the one-line truth) → cheapest next action.
5. This command is advisory: report, do not fix, do not block.
