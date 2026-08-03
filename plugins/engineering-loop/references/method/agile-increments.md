# Agile Increments

## Vertical slices of working software

The unit of delivered value is a vertical slice: a thin path through every layer the outcome needs — schema to logic to surface — that demonstrably works end to end. Slices are distinct from atomic mutations: the atomic changeset is the unit of *review*; the slice is the unit of *value*. The two compose — **a stack of atomic PRs should compose a vertical slice** — so that each PR is small enough to review responsibly while the completed stack delivers something a user or downstream system can actually exercise. A horizontal layer ("all the models, then all the services") is inventory: partially-done work that validates nothing until the last layer lands.

## Definition of Ready — gates entry to Execute

No node enters Execute without four things stated:

1. **Intent** — the real goal, distinguished from the literal ask.
2. **Acceptance criteria** — what observably true means done.
3. **Evidence plan** — how each claim will be validated, pre-registered before execution (or an explicit commitment to the thinnest slice that measures it).
4. **Declared scope** — the files, surfaces, and external state the change will touch, locked at Plan exit.

A node missing any of the four is not ready; executing it anyway converts planning debt into rework at the most expensive possible moment. DoR is cheap precisely because it runs before effort is sunk.

## Definition of Done — the phase exit gates

Done is not a feeling; it is the phase exit gates, passed. For a node: mutation within declared scope (drift-audit clean), gauntlet green at full strictness, pre-registered evidence executed and met, self-review prosecution passed, outer loop closed (CI terminal-green on the head SHA, review threads resolved) where the infrastructure exists. Anything less is partially-done work — a tracked waste, not a soft success.

## Re-plan when reality contradicts the graph

The work-graph is a hypothesis about the work, and execution is its experiment. When reality contradicts the plan — hidden coupling discovered, a "mechanical" change turning behavioural, an assumption failing — **re-plan the graph mid-flight**. Update nodes, edges, tiers, and scopes through the planning gates; never silently absorb the surprise into the current node's scope. Pushing on with a falsified plan is not persistence, it is over-production against a stale map. Past effort is not evidence of present value: judge the re-plan on current evidence, sunk costs excluded.

## Gall's law

Working complex systems grow from working simple ones; a complex system designed from scratch never works and cannot be patched into working. Operationally: evolve via slices, each leaving the system working; never attempt a big-bang integration whose first validation is also its largest. If a design cannot be reached through a sequence of working intermediate states, treat that as evidence against the design, not as a reason to skip the intermediate states.

## WIP limits and pull

Limit work in progress and pull, don't push. Little's Law makes lead time proportional to WIP at fixed throughput, so starting more slows everything already started. Pull new nodes only when capacity frees — especially into the constraint, usually human review attention: never stack unreviewed PRs faster than the reviewer drains them. One-piece flow through the stack beats batch-and-hope.

## Spikes are evidence-gathering

A spike is a node whose deliverable *is* knowledge: build-to-learn beats speculative analysis whenever the build is cheaper than the argument. Because a spike is itself the evidence step, it is **exempt from the evidence gate** — demanding pre-registered evidence for the act of gathering evidence is circular ceremony. Spikes carry their own discipline instead: a question they must answer, a timebox, and the rule that spike code is scaffolding — it informs the real slice, it does not ship as one.
