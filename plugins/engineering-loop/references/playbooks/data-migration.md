# Playbook: Data Migration

## Frame

Establish what is actually moving: schema, data, semantics, or all three — changing a column's MEANING is a migration even when no DDL runs. Enumerate every consumer of the affected data (queries, services, reports, downstream pipelines) via lineage and contracts; Hyrum's law is literal here — someone depends on that column's nulls. Classify reversibility per step: shipped data cannot be unshipped, so any step without an engineered reversal path is a one-way door and forces Tier 2.

## Plan

Expand/contract is the native PR stack for this workload — the migration decomposes into exactly these atomic slices, each independently shippable and independently revertable:

1. **Expand**: add the new column/table/topic alongside the old. Purely additive; trivially reversible.
2. **Backfill**: populate the new structure from the old.
3. **Dual-write**: writers populate both structures; old remains authoritative.
4. **Cut over reads**: consumers move to the new structure, one consumer per slice where blast radius warrants it.
5. **Contract**: drop the old structure — only after evidence that nothing reads it (query logs, lineage), and after a deprecation window.

Every step's plan declares its REVERSAL STRATEGY and BLAST RADIUS explicitly: "revert = stop dual-write, old path untouched" or "revert impossible past this point — forward-fix via corrective backfill; snapshot taken at T". The Plan gate rejects any step whose reversal line is blank. Where revert is impossible, pre-plan the forward-fix: which snapshot, which replay, which consumer notification.

The Plan gate demands this evidence, pre-registered:

- **Backfill idempotency: run-twice-diff-zero.** Execute the backfill twice against the rehearsal copy; the data-diff between runs must be empty. A backfill that cannot safely re-run will fail you exactly when it half-completes at 3am and must resume.
- **Dry-run on a prod clone** as plan-before-apply evidence: the concrete row counts, distributions, and data-diff from a production-shaped copy — sample data hides the skew, the duplicates, and the 1997 legacy rows that will break the real run.
- **Lineage/contract check on every consumer BEFORE cut-over**: each enumerated consumer either passes its contract test against the new structure or has signed off on the change. Cut-over with unverified consumers is how bad data ships silently.
- **Lock-time estimates** for every DDL and bulk update, measured on the clone, with the online-migration alternative named if the estimate exceeds the availability budget.

## Execute

One expand/contract step per changeset; the drift-audit compares declared scope against the PREVIEWED REAL MUTATION (the migration plan, the data-diff), not just the source diff. Between steps, let each soak: dual-write runs long enough to produce comparison evidence (old vs new, diff-zero) before reads move.

## Verify

Post-apply, re-run the comparison: counts, checksums, distribution guardrails, consumer contract tests. Correct-at-sample is not correct-at-scale — verify on the full population.

## Self-review and Reconcile

If bad data escapes despite the gates, do not thrash in reconcile — fork to the data-incident playbook and forward-fix.

## Kaizen

Log the classics: contract steps executed before the deprecation window closed, backfills that were not idempotent (found in anger), consumers discovered only at cut-over. Each one is a missing lineage or DQ gate — register it.
