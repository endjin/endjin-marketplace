# Contracts and Lineage

## Hyrum's law

With enough consumers, **every observable behaviour of a system will be depended on by somebody** — not just the documented contract, but the incidental: error-message text, ordering that was never promised, timing, nullability in practice, the exact set of columns a query returns. Consequence: any observable change, however incidental it looks from the producer's side, is a breaking-change candidate. "We never documented that" is not a defence available in practice; the dependency exists whether or not it was invited.

## Enumerate consumers before changing an interface

Before changing any interface, endpoint, event shape, or a column's semantics, **enumerate the consumers** — via lineage, not memory. For code: callers, implementors, reflection and serialization sites, published-package dependents. For data: every query, dashboard, downstream table, export, and model reading the column — walked from the lineage graph or the warehouse query log, because the consumer nobody remembered is the one that breaks. Column *semantics* count as interface: changing units, timezone, null-meaning, or encoding while the type stays identical is the most dangerous break precisely because nothing fails loudly — every downstream silently computes wrong answers.

The enumeration is evidence, and it is prosecutable: "no consumers are affected" is a claim requiring the lineage walk attached, not an assertion. Unknown consumers (public APIs, published datasets) mean the enumeration cannot complete — treat the change as breaking by default and manage it through deprecation, versioning, and announcement.

## Data contracts and contract tests

Make the implicit explicit. A **data contract** states, in checkable form, what a producer promises: schema, types, nullability, semantics and units, freshness, volume bounds. **Contract tests** verify both sides mechanically — the producer's output honours the contract; each consumer's expectations are a subset of it — and run in the gauntlet, so a breaking change fails at the source (the producer's inner loop) rather than in the consumer's production. A contract turns Hyrum's law from ambient dread into a managed boundary: inside the contract is promised and tested; observable-but-outside is explicitly unpromised, and the contract document is where that line is recorded.

## Expand-contract over breaking

When a contract must change, never break in place. Expand: add the new column, field, or endpoint alongside the old. Migrate consumers at their own pace, with both shapes live and divergence observable. Contract: remove the old shape only after lineage confirms zero remaining consumers — and the removal is its own gated, announced change. This maps directly onto the stacked-changeset discipline (add → backfill → dual-write → cut over → drop): each step reviewable, each step revertible, no moment at which a consumer is forcibly broken.

## Artifact provenance

Every derived artifact — a dataset, a trained model, a report, a generated file — carries **provenance**: the pinned inputs (versions, snapshots, partitions) it was derived from, the exact code version that produced it, and the parameters of the run. Provenance is what makes an artifact **reproducible** (run the same code on the same inputs with the same params, get the same artifact) and **auditable** (answer "why does this number say X?" by walking back to sources). An artifact without provenance is an orphan: it cannot be regenerated, cannot be trusted after its inputs change, and cannot be debugged — treat producing one as a defect in the pipeline that made it.

Provenance is **distinct from decision records**. Provenance answers *how this artifact came to be* — mechanical, per-artifact, machine-captured. Decision records (ADRs) answer *why this design was chosen* — judgment, per-decision, human-ratified, capturing the options weighed and the trade taken so it is never re-litigated from scratch. Both are durable assets; neither substitutes for the other. A pipeline needs provenance on every run and an ADR only when its design changes.
