# Platform pack: dbt (stub)

Load this pack when the repo fingerprints as dbt (`dbt_project.yml`, `models/`,
`profiles.yml`). This is a stub: gauntlet shape and the evidence idioms that matter most for
transformation code; grow it with earned lessons.

## The verification gauntlet (fastest-first)

1. `dbt parse` — cheapest signal; catches ref/config errors before any warehouse time.
2. `sqlfluff lint` at the repo's configured rules; expect 0 findings.
3. `dbt build --select state:modified+` — build and test only what changed plus downstream,
   using `--defer --state <prod-artifacts>` for slim CI so unchanged upstreams resolve to
   production relations instead of rebuilding the world.
4. `dbt test` results at full strictness: a warn-severity test that fires is a signal to
   triage, not noise.

## Evidence gate: data-diff old vs new

For any model change that claims equivalence ("refactor", "performance", "migration"), the
evidence is a **data diff of old output vs new output** — row counts, key coverage, and
column-level comparison on the real warehouse, pre-registered before the change. "It builds
and tests pass" is a proxy; the diff is the outcome.

## Contracts and the incremental decision

- Enforce model contracts (`contract: enforced`) on public models; a column's type or meaning
  is an interface — enumerate consumers before changing it.
- **Incremental vs full-refresh is the platform's core idiom decision.** Declare it per
  model at plan time: incremental models must be replay-safe (late-arriving data, reruns
  converge), and any change to incremental logic requires a `--full-refresh` validation run
  compared against the incremental result.

## Grow this pack via kaizen

Stubs accrete lessons through the registry: when a defect on this platform root-causes to a
gate this pack should have stated, emit the lesson as a `platform:dbt` record and fold the
ratified rule into this file.
