# Evidence gate protocol

## When evidence is mandatory

Any quality-attribute claim — *faster, smaller, safer, cheaper, more reliable, more scalable* — forces Tier 2 for that node. This is non-negotiable and cannot be self-waived: the claim is a hypothesis (truth 1), and the node may not exit Plan until either evidence is pre-registered or the claim is withdrawn from the plan's rationale. Overriding down from a claim-forced Tier 2 requires explicit human accept-with-justification, logged.

## Pre-registration

To pre-register evidence, commit an **immutable, hashed artifact** to `.engineering-loop/evidence/<node>/` **before** any execution, containing:

- **Metric** — the exact quantity measured, and on what system (the real system, or the closest faithful proxy with the gap stated).
- **Threshold** — the pass/fail line, stated as a falsifiable inequality ("p50 lookup ≥ 10% faster on the production key distribution"), plus the decision rule for a miss.
- **Workload** — the concrete inputs: shapes, sizes, distributions, environment. Measuring a convenient workload instead of the risk-relevant one is the most common way evidence lies.
- **Required n / significance** — how many runs, and what statistical bar, before the result counts.

The artifact's hash is recorded in `gates.json`. Any post-hoc edit to the pre-registration invalidates the evidence — results are only admissible against the registered version.

## The falsifiability check

Before the experiment runs, the prosecutor asks one question: **"could this experiment actually fail?"** If no plausible outcome would refute the claim — threshold set below the noise floor, workload chosen to flatter, metric that moves with any change — the pre-registration is rejected. Evidence that cannot fail is not evidence. This check runs at Plan, before cost is sunk.

## Evidence via thinnest slice

Pre-registered measurement is not the only admissible form. When building the smallest thing that measures is cheaper than analysing, **commit to the thinnest slice that produces the signal** — a spike *is* the evidence step. Build-to-learn beats speculative analysis whenever it is cheaper; the spike's exit criterion (what question it answers, what result means go/no-go) is pre-registered exactly like a benchmark. Spike output feeds the plan; spike code is disposable by default.

## Statistical evidence

Where outcomes are non-deterministic or data-dependent (truth 4) — ML models, distributed systems, sampled pipelines — one green run proves nothing. Require distributional evidence: confidence intervals over repeated runs, guardrail metrics that must not regress, holdout or shadow evaluation against the live baseline. The pre-registration states the n and the interval, not just the point target.

## Plan/dry-run evidence

Where the effect lives in an external system (truth 9), the evidence is a **preview of the real mutation**: `terraform plan`, a migration dry-run, a data-diff of before/after rows on a representative partition. The reviewed artifact is the concrete diff the system will apply, not the source that generates it. Drift between declared scope and the previewed mutation is a gate failure.

## Auto-fail rules

- Results that miss the registered threshold **auto-fail** — no post-hoc threshold negotiation, no "close enough". The honest paths are: withdraw the claim, revise the pre-registration and re-run, or escalate to the human.
- Evidence that was registered but never executed fails the node at Verify: "green" requires the pre-registered evidence to have actually run.
- Convenient confirmations are interrogated like surprises (truth 2) before acceptance.

## "Not applicable"

A node may argue evidence is not applicable (pure mechanical rename, no claims made). At Tier 2 this requires **prosecutor concurrence, not self-declaration**: the claim of non-applicability is itself prosecuted, and a recorded evidence verdict of `ABSENT` (= not applicable; cited reasoning in `detail`) lands in `gates.json`. At Tier 0/1, where no prosecutor runs, record the n/a declaration with one line of reasoning in the advisory self-review — self-declared, but on the record.

## Worked example: frozen collections

The canonical failure this gate exists to prevent. On the reaqtor .NET 10 migration (PR #155), 42 lookup tables were converted to `FrozenDictionary`/`FrozenSet` because frozen collections *sounded* faster — no metric, no threshold, no workload registered. The claim shipped. A reviewer challenged it; only then were the repo's actual shapes benchmarked: small (2–30 entry), reference-type-keyed tables measured **1.18–1.24× slower** frozen, and the custom-comparer set was a wash. The conversion was reverted (`43168be`).

Run through this protocol, the failure is caught at Plan: "frozen is faster" is a quality-attribute claim → Tier 2 forced → pre-registration demands metric (lookup latency), workload (the repo's real table shapes and key types), threshold (must beat baseline) → the falsifiability check passes (it can fail — and did) → the benchmark runs **before** conversion → the claim dies at the cost of one benchmark instead of a shipped-and-reverted changeset plus a review cycle. The validation was always going to happen; the gate's only job is to make it happen upstream of the mutation.
