# Stacked Atomic Changesets

One atomic mutation per stacked PR. A reviewer should be able to hold the entire change in mind, verify it does exactly what it declares, and approve or reject it as a unit. Everything in this reference serves that single property.

## The cycle: declare-scope → mutate → drift-audit → stack

Per node: **declare** the scope (files, surfaces, behaviours the change will touch), **mutate** within it, **drift-audit** the actual mutation against the declaration, then **stack** the changeset as the next PR on the branch chain. Scope is **locked at Plan exit** — it is not a living document to be widened when execution gets interesting. Widening scope is a re-plan, through the gates.

Scope is also prosecuted for **tightness**: an over-broad declaration ("may touch anything under src/") defeats the audit, because nothing is ever drift. A declaration that could not fail the audit is not a declaration.

## Caps and anti-fragmentation

Cap files and hunks per changeset — a diff too large to review atomically is two changesets. But the cap cuts both ways: **artificially fragmenting coupled changes is itself flagged**. Splitting an interface change from the only call-site that makes it compile does not create two atomic changes; it creates two broken ones. Atomic means "smallest unit that is complete and correct", not "smallest unit".

## Mechanical / semantic separation

An enabling refactor and a behaviour change are **separate changesets**. The mechanical changeset (rename, move, format, mechanical API swap) should be verifiable by inspection plus a green build — behaviour provably unchanged. The semantic changeset carries the behaviour change and its evidence. Mixing them forces the reviewer to hunt the semantic needle in a mechanical haystack, which is precisely where escaped defects live.

## The stack composes a vertical slice

Atomic mutations are the unit of review; **vertical slices of working software** are the unit of value. A stack of atomic PRs should compose a slice: each PR is independently reviewable and mergeable in order, and the completed stack delivers something demonstrably working. **Trunk stays releasable** at every merge — no PR in the stack may leave trunk in a state that cannot ship.

## The unit of change spans code + external state

Where the effect of a change lives in a target system — cloud infrastructure, a database schema, a warehouse table, an ML feature store — the source diff is not the change; it is a *description* of the change. Drift-audit must therefore compare the declared scope against the **previewed real mutation**: `terraform plan` output, a migration dry-run, a data-diff of affected rows — not just the textual diff. A one-line HCL edit whose plan destroys and recreates a database is a large, one-way change wearing a small diff. Preview the real mutation before committing it; audit the preview, not the prose.

## Expand/contract maps natively onto the stack

Breaking changes to live state decompose into a stack of individually safe, individually reversible steps:

1. **add** — introduce the new column/table/endpoint alongside the old (additive, safe);
2. **backfill** — populate the new structure from the old (idempotent, resumable);
3. **dual-write** — write both paths; read still on old (divergence observable);
4. **cut over** — switch reads to new (small, instantly revertible);
5. **drop** — remove the old path (only after the cut-over has soaked).

Each step is one atomic changeset with its own scope, evidence, and drift-audit; the stack is the migration. At no point is the system in a state that cannot run or roll back — which is the whole point.
