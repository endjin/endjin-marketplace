# Cost as a Quality Attribute

Compute, storage, egress, query cost, and latency-at-scale are **first-class acceptance criteria** — peers of correctness, not a finance concern to be discovered on next month's bill. A change that produces the right answer while doubling the warehouse spend, saturating egress, or blowing the latency budget at production volume has failed its acceptance criteria. **A cost regression is a defect even when functionally correct**, and it enters the loop as one: root-caused, gated, and counted in the escaped-defect and repeat-defect metrics like any other defect class.

## Pre-register cost budgets in the evidence gate

Cost claims obey the same law as every quality claim: "better" is a hypothesis, and a hypothesis needs pre-registered falsification conditions. Before executing a node that touches a cost-relevant path, register the budget in the evidence plan:

- the **metric** — bytes scanned per query, compute-hours per run, egress per day, p99 latency at stated volume, storage growth rate;
- the **threshold** — the number that constitutes failure, stated as a bound, not a vibe ("no more than 10% over current baseline", "under $X per million rows");
- the **workload** — the concrete query set, data volume, and access pattern the measurement runs against;
- the **baseline** — the current system's measured number, captured before the change, because a budget without a baseline cannot detect a regression.

Results missing the bar auto-fail; a budget registered after seeing the numbers is not a budget. "Cheaper" as a motivating claim forces the full evidence treatment — the frozen-collections rule applies to money exactly as it applies to speed.

Where a deploy target exists, cost joins the standing loop: monitors on spend and latency alongside health, so a cost regression that slips through surfaces as a signal, not as a quarterly surprise.

## Correct-at-sample is not correct at scale and skew

The sample lies, in two independent ways.

**Scale.** Costs and latencies are rarely linear in volume. The query that scans 10 MB in dev scans 10 TB in production; the O(n²) join is invisible at a thousand rows and fatal at a billion; the per-row API call is fine at sample size and a rate-limit incident at full volume. A green run on sample data validates logic; it validates *nothing* about cost or latency at production volume. Extrapolation is a hypothesis — measured, not assumed.

**Skew.** Production data is not uniformly shaped. Hot keys concentrate load on one partition while the sample spread it evenly; one customer owns half the rows; nulls, duplicates, and pathological values cluster in ways a uniform sample never exhibits. A join or aggregation that is cheap on well-distributed sample data can degenerate on skewed real data — same logic, same volume class, order-of-magnitude cost difference.

Therefore: **validate on production-shaped data.** The evidence workload must reflect production's volume (or a measured, stated scaling model from a volume the extrapolation is defensible over) and production's distribution — real skew, real hot keys, real null rates — via a production snapshot, a statistically faithful sample, or shadow execution against the live shape. A cost budget validated against convenient uniform data is a proxy passing while the outcome fails; the risk-relevant matrix for cost is defined by scale and skew, and evidence that skips them is negligent, not merely incomplete.
