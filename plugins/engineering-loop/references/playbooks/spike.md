# Playbook: Spike

## Frame

Frame a spike as a question, not a deliverable. Write the question so it can be answered decisively: "can library X parse our worst-case file under 2s?", "does approach Y survive concurrent writers?" — not "explore X". Name the decision that hangs on the answer; if no decision depends on it, the spike is curiosity dressed as work, and YAGNI applies. Then set the timebox. The timebox is the budget, agreed at Frame, and it is a hard stop: when it expires you report what you learned, even if the answer is "inconclusive — here is what a decisive test would cost". Spikes run Tier 0/1; the ceremony must stay lighter than the question is worth.

## Plan

A spike IS the evidence step — it is the loop's own mechanism for when building-to-learn is cheaper than speculative analysis. It is therefore EXEMPT from the evidence gate: you do not pre-register validation for a spike, because the spike exists to produce exactly the evidence a later plan will pre-register. Do not let this exemption leak: it covers the spike node only, never the production work that follows it.

The plan for a spike is minimal by design: the question, the timebox, the cheapest experiment that could answer it, and the disposal declaration (see Execute). The work-graph marks the node `spike`, and downstream nodes that depend on its answer stay blocked until it reports.

## Execute

Write the cheapest code that answers the question. Skip the production gauntlet deliberately: no tests beyond what the experiment needs, no error handling for paths you are not probing, no naming polish, hard-coded inputs welcome. This is not sloppiness — it is right-sized ceremony; polishing throwaway code is over-processing waste.

The spike's code is disposable BY DEFAULT. Keep it out of trunk: a scratch branch, a scratch directory, clearly named. The moment spike code quietly survives into production, unreviewed and untested, you have shipped the worst of both worlds.

## Verify

Verification is answering the question, not passing a gauntlet. Run the experiment; capture the observation (numbers, failure modes, screenshots, logs) with enough provenance that someone can trust it later without re-running.

## Self-review and Reconcile

The output is a DECISION plus recorded rationale — never production code. Record: the question, what was tried, what was observed, the answer, the confidence, and what was explicitly NOT tested. File it where decisions live (ADR, memory, kaizen log). Decisions are durable assets; an unrecorded spike will be re-litigated and re-run within the year, which is pure rework.

Then dispose. If the answer says "proceed", promoting the approach to production RE-ENTERS THE LOOP AT PLAN: the real implementation gets pre-registered evidence, declared scope, the full gauntlet — the spike's conclusion informs that plan, the spike's code does not shortcut it. Rewriting from a working understanding is fast; the spike already paid the learning cost.

## Kaizen

Wastes to log: spikes without a decision consumer, timeboxes silently extended (a doubled timebox is a re-plan, not a drift), spike code found in trunk (register a lens: scratch paths never merge), and questions re-spiked because the first answer went unrecorded.
