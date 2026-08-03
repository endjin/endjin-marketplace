---
description: Produce an evidence-gated plan for a piece of work — pre-registered validation, idiom boundaries, locked scope (advisory; you execute)
argument-hint: "<what you intend to change>"
allowed-tools: ["Read", "Write", "Glob", "Grep", "Bash", "Task", "AskUserQuestion"]
---

**Intent:** $ARGUMENTS

Produce an evidence-gated plan, standalone — the human (or a later `/engloop` run) executes it.

1. Clarify the **real goal** vs the literal ask (one inline confirm). Detect the platform and
   load its pack from `references/platforms/`.
2. Decompose into atomic nodes and, per node, produce the Definition-of-Ready record per the
   `engineering-loop-plan` skill and the merged `plan-checklist.yaml` registry:
   hypothesis + checkable acceptance criteria; **pre-registered validation for any
   quality-attribute claim** (metric, threshold, workload, required n — immutable once
   registered; or the thinnest-slice-that-measures); idiom allow/deny with exclusion criteria;
   declared scope (tight, locked); reversibility classification + blast radius; consumer
   enumeration for observable changes; how success will be observed.
3. Run one advisory self-review pass over the plan lenses from the merged registry and attach
   the findings.
4. Output the plan as a reviewer-ready document (suitable for posting to an issue for
   sign-off, per `references/method/evidence-gate-protocol.md`). Write it to a file if the
   user names one; otherwise present it inline.

Do not execute any of it. If a claim cannot be validated cheaply, say so explicitly and propose
the thinnest slice that would produce the measurement.
