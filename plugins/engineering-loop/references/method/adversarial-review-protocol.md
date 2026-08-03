# Adversarial review protocol

The prosecutor's job is refutation: find the specific, citable way an artifact fails its gates. The protocol below keeps that adversarial pressure honest — strong enough to catch real defects, constrained enough that it cannot degrade into vibes-blocking or be gamed by the author.

## Blind review

The prosecutor receives exactly two inputs: the **artifact** (plan, diff, evidence bundle) and the **machine-readable gate criteria** from the merged registry. It never receives the author's persuasive rationale, chat narrative, or self-assessment. Persuasion is the primary channel by which a convergence-pressured author launders a weak artifact past review; blinding removes the channel. If context is genuinely required to judge the artifact, that context belongs *in* the artifact — which is itself a finding.

## Registry-loaded lenses

Lenses are loaded at startup from the merged registry — plugin seed, then user overlay, then project overlay — **never hardcoded** in the prosecutor. The prosecutor owns no rules of its own; it applies whatever the registry says, filtered by `applies_when` selectors (a `platform:dotnet` lens never fires on a Python artifact). This is what makes kaizen real: a lesson learned in run N becomes an active lens in run N+1 without touching the engine.

## Structured verdicts

Every verdict is structured JSON appended to the `.verdicts[]` array of
`.engineering-loop/gates.json` (the canonical schema — the router skill's state contract
governs):

```json
{ "node": "perf-1", "gate": "prosecution", "prosecutor": "plan", "verdict": "REJECT",
  "detail": { "lens_results": [ { "lens_id": "evidence", "verdict": "REJECT",
    "cited_text": "…quoted from the artifact…", "cheapest_fix": "…" } ] },
  "timestamp": "…" }
```

Verdicts are enforced by hooks reading `gates.json` — never narrated by the driver agent, which must not be able to paraphrase a rejection into a pass. A parent cannot read a subagent's context; the file is the only channel, so the file is the record.

## Rejection validity

At Tier 2 the standard is **REJECT-if-uncertain**: when the prosecutor cannot establish that a gate is met, the verdict is REJECT, not benefit-of-the-doubt. But a rejection is **VOID unless it cites a specific gate id and quoted artifact text**. "This feels risky" blocks nothing. This pair of rules balances the protocol: uncertainty resolves against the artifact, yet every block is traceable to a registered criterion and a concrete sentence, so authors can always compute the cheapest satisfying action and over-rejection is auditable.

## First verdict binds

Re-rolling the panel on an unchanged artifact is forbidden. A rejection stands until the artifact materially changes; re-prosecution is triggered only by a new artifact hash. Without this rule, a driver under convergence pressure simply re-samples prosecutors until one passes — turning the gate into a dice roll.

## Calibration canaries

Each Tier-2 run also prosecutes a **planted known-bad artifact** alongside the real one — the plugin ships one at `${CLAUDE_PLUGIN_ROOT}/registry/canary-known-bad-plan.md` (reference it in place; never copy or commit it into the target repo). Canary verdicts are recorded with `node: "calibration-canary"` (a reserved id, never a graph node) so a canary REJECT — which is the *correct* outcome — is never counted as a mid-flight failure by the Stop guard. A prosecutor that passes the canary is miscalibrated — sycophantic, context-poisoned, or degraded — and the run **escalates to the human** rather than trusting any of that prosecutor's verdicts. Symmetrically, canary and false-positive metrics flag a chronically over-rejecting prosecutor; both failure modes are measured, not assumed away.

## Panel sizing by tier

- **Tier 2:** an N-up panel of prosecutors with **genuinely diversified lenses**. **Default N = 2** (one covering the empiricism/evidence gate family, one covering change-discipline/scope/structure), **+1 per additional engaged gate family** (e.g. a one-way-door node adds a reversibility/blast-radius member) — never N copies of the same checklist, which multiplies cost without multiplying coverage. Panel verdicts land individually in `gates.json`; any valid REJECT blocks.
- **Tier 1:** a **single-pass self-review** over the lens registry. Verdicts are **advisory** — a failed gate warns and asks (continue / split / abort) rather than blocking.
- **Tier 0:** no prosecution; the gauntlet (tests green, build clean) is the whole gate.

## Tone

Below Tier 2, review output is collegial and actionable, never theatrical. Every finding states, in order: **what failed → why it matters** (the one-line universal truth) **→ the cheapest next action** that satisfies the gate. Never emit "PROSECUTOR REJECTS" styling at advisory tiers; the adversarial stance is an internal discipline for finding defects, not a register for addressing humans or authors. At Tier 2 the verdict is binary and machine-read from `gates.json` — tone is irrelevant there because prose is not the channel.

## Failure handling

If a prosecutor cannot parse the artifact, times out, or returns malformed JSON, the verdict is recorded as `ERROR`, never silently treated as a pass. Repeated errors on the same artifact escalate to the human with the artifact and criteria attached.
