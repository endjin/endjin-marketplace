# Playbook: New Feature

## Frame

Clarify the real goal before touching the literal ask. A feature request is a proposed solution; interrogate the problem behind it. Ask: who is blocked, on what, and how will we observe that they are unblocked? If the answer to the last question is missing, Frame is not done. Record the real goal and the literal ask separately in the work-graph — when they diverge mid-flight, you re-plan against the goal, not the ask.

Size honestly. A one-file, reversible feature is Tier 0. A new interface or persisted state escalates to **Tier 1** (observable-contract and prove-not-quiet review); a quality-attribute claim ("faster", "simpler for users") forces **Tier 2** for that node.

## Plan

Decompose into vertical slices, not horizontal layers. Each node in the work-graph is a thin end-to-end path through the system that a user (or a test acting as one) can exercise — never "build the data layer" then "build the API" then "wire the UI". A stack of atomic changesets composes one slice; trunk stays releasable between slices.

Acceptance criteria ARE the pre-registered evidence. Write them as falsifiable observations before Execute: given X, the system does Y, observed by Z (a test, a log line, a metric). Criteria that cannot fail are not criteria. The Plan gate demands: real goal restated, slices ordered thinnest-first, acceptance criteria per slice, and an explicit idiom allow/deny for any new pattern the feature introduces.

Order by Gall's law: working complex systems grow from working simple ones. Ship the thinnest slice that validates the riskiest assumption first — it is both the cheapest evidence step and the earliest point a wrong bet can be reversed. If the thinnest slice invalidates the premise, you have spent one slice, not a feature.

Guard against speculative generality with YAGNI. Every abstraction, extension point, configuration knob, or "while we're here" generalisation is an unvalidated hypothesis about a future need. The prosecutor challenges each one: name the second concrete consumer, or cut it. Interfaces with one implementation, parameters with one caller, and flags nobody flips are canonical wastes for this workload.

## Execute

One slice per changeset stack; declare scope before mutating and hold to it. Enabling refactors (making room for the feature) are separate changesets from the feature behaviour itself. No residue: no commented-out scaffolding, no dead flags from abandoned directions.

## Verify

Run the acceptance criteria as executable checks — not "the code compiles" but "the observation registered at Plan time occurred". Add the new behaviour to the standing suite so the criteria become permanent regression armour. Then run the full gauntlet: the feature must not degrade anything it did not declare.

## Self-review and Reconcile

Prosecute the diff for undeclared scope and for speculative generality that survived Plan. In review, expect the reviewer's first question to be "why?" — the recorded real goal is your answer; link it.

## Kaizen

Common wastes to log: features built layer-wise that never integrated (inventory), abstractions built for consumers that never arrived (over-production), and acceptance criteria written after the code (evidence theatre). If a shipped feature misses the real goal, root-cause to Frame: what question would have exposed the gap in the first five minutes?
