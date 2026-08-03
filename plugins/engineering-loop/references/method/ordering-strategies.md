# Node-Ordering Strategies

Once the work-graph exists, order is a decision, not an accident. Dependency edges constrain order; within the freedom that remains, choose deliberately among three strategies — and state which one is driving.

## Foundation-first

Execute the nodes that everything else builds on: shared infrastructure, the enabling refactor, the schema change, the tooling upgrade. Foundation-first minimises rework (later nodes land on their final substrate rather than being rebased across it) and suits work whose shape is well understood. Its failure mode is deferred validation: a long foundation phase during which nothing end-to-end has been proven. Bound it with Gall's law — the foundation itself must be built as working increments, and a vertical slice should cross it as early as possible.

## Risk-first

Execute the riskiest, most uncertainty-laden nodes first: the unproven integration, the performance-critical path, the migration nobody fully understands. Risk-first buys the cheapest possible failure — if the hard part is impossible, learn it before investing in the easy parts that depend on it. Prefer it whenever a node's failure would invalidate the plan. Spikes are its natural instrument: a timeboxed evidence-gathering node placed ahead of the commitment it informs.

## Cost of delay: CD3 / WSJF

Where nodes compete for the same capacity, sequence economically: **CD3 (cost of delay divided by duration)**, also known as WSJF — weighted shortest job first.

```
priority = cost of delay ÷ duration
```

Cost of delay is what postponing the node costs per unit time: revenue deferred, risk borne, waste accruing, other work blocked. Dividing by duration favours short, high-urgency work: a two-day node relieving an expensive wait outranks a two-week node of equal total value. CD3 exposes the hidden error in "biggest value first" (which ignores how long the value is delayed for everything queued behind) and in "quick wins first" (which ignores what the quick wins delay). Estimate both numbers roughly; the ranking is robust to imprecision, and stating the estimates makes the ordering arguable — which is the point.

## Worked example: the LTS leapfrog

A modernisation ordering pattern from the reaqtor .NET work. The platform ships yearly, alternating LTS (long-term support) and STS (short-term support) releases. The strategy: **only retarget on LTS releases; skip STS entirely; between retargets, verify SDK-compatibility passes only.**

Concretely: the codebase targeted .NET 6 (LTS, 2022), then deliberately skipped the .NET 7, 8, and 9 retargets, landing directly on .NET 10 (LTS, 2026). Each skipped release cost only a cheap verification that the current target still built and tested under the newer SDK — not a full retarget, re-baseline, and re-verify cycle.

The economics in CD3 terms: an STS retarget has high duration (the full modernisation gauntlet across the matrix) and low cost of delay (STS support windows are short; the target would be re-done within a year anyway — the work is over-production with an expiry date). The LTS retarget has the same duration but a real cost of delay: expiring support, accumulating language-version drift, and a growing gap that makes the eventual jump harder. So the LTS node ranks; the STS nodes do not merely rank lower — they fall below the line entirely and are cut. The leapfrog also batches accumulated change (four years of language and library evolution) into one well-evidenced modernisation run rather than four shallow ones, trading batch size for eliminated repetition — a trade that works precisely because SDK-compat checks between LTS jumps kept the risk observable in the interim.

The general lesson: recurring maintenance work has a *cadence choice*, and the cadence is an ordering decision to make on cost-of-delay grounds, not a default to inherit from the upstream release calendar.
