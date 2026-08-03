# Playbook: performance / optimization

The workload other playbooks route here when a change's justification is a quality attribute —
faster, smaller, cheaper, lower-latency, less memory. Every node in this playbook is
claim-bearing by definition: **`required_evidence: true`, Tier 2, no exceptions.** This is the
frozen-collections playbook: the canonical waste this loop exists to prevent was a performance
idiom adopted on plausibility, shipped, and reverted after measurement.

## Frame

Pin the *real* goal to a number before anything else: which operation, measured how, is too
slow/large/expensive — and what would "fast enough" be? "Make X faster" with no baseline
measurement is not a goal; the first node is then *measure the baseline*, nothing else.
Distinguish the three distinct targets — latency, throughput, cost — they optimise differently
and often against each other. Name the constraint: is this operation actually on the critical
path, or merely idiomatic to optimise (YAGNI applies to speed too)?

## Plan

- **Pre-register before building** (evidence-gate-protocol.md): metric, threshold ("the claim
  fails if improvement < N%"), workload = the system's **actual shapes** — real data sizes,
  real key types, real distributions. Synthetic favourable benchmarks are how plausible-but-
  wrong optimisations survive to review.
- Where the optimisation must exist to be measured, commit to the
  **thinnest-slice-that-measures**: one site converted, measured, keep-or-kill by the
  registered bar — never "convert everything, then benchmark".
- Idiom allow/deny: an optimisation pattern gets an explicit boundary (which sites qualify,
  which are excluded and why).
- Reversibility is usually two-way (code), but check for one-way effects: changed persistence
  formats, cache invalidation, wire contracts.

## Execute

One optimisation per slice, never mixed with functional change (a perf slice must be
behaviour-preserving — the test suite is the invariant, the benchmark is the evidence).
Enabling refactors are separate preceding slices.

## Verify

Run the pre-registered benchmark exactly as registered; missing the bar kills the node —
reverting an unbuilt optimisation costs nothing, which is the point of measuring first.
Interrogate flattering results as hard as failures (measured *why* is it faster — or the win
is noise or a broken benchmark). Guard the whole matrix: an optimisation for the hot path must
not regress the cold path, memory, or cost.

## Kaizen

A killed optimisation is a *success* of the process — record the negative result as a lesson
(with the measured numbers) so the idiom is never re-proposed without new evidence.
