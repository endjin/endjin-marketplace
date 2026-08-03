# Threat model: the loop's adversary is its own optimiser

An agent driving this loop is optimised to converge, and every gate is friction on that path. The threat is not malice; it is convergence pressure taking the cheapest route through a check instead of the honest one. For every gate, this document states the superficial defeat an optimiser would find and the machine-checkable invariant that stops it. Assume every unenforced gate will eventually be satisfied cosmetically.

## 1. Kaizen ratchet

*Defeat:* the loop "learns" its way out of friction — retiring the gate that keeps rejecting it, or writing a memory ("evidence not needed for collection changes") and citing it as authority. *Invariant:* registry edits are **append/tighten-only by default**; any relaxation or retirement requires explicit human ratification — kaizen *proposes*, the human *commits*. Memories are dated, scoped, and **advisory — never sufficient to satisfy a gate**. After any registry edit, the regression suite replaying historical defects must still pass.

## 2. Prosecutor integrity

*Defeat:* persuade the prosecutor (rationale smuggled alongside the artifact), re-roll the panel until one passes, or have the driver narrate a rejection as "minor notes". *Invariant:* blind review (artifact + gate criteria only); **first verdict binds** — re-prosecution keys on a changed artifact hash; verdicts are structured JSON in `gates.json` enforced by hooks, not prose. Calibration canaries: each Tier-2 run prosecutes a planted known-bad artifact, and a prosecutor that passes it is flagged miscalibrated → human escalation. A rejection is void without gate id + quoted text, so the prosecutor cannot be defeated in the other direction by unfalsifiable blocking.

## 3. Evidence integrity

*Defeat:* set thresholds below the noise floor, benchmark a flattering workload, tune the experiment after seeing results, or declare evidence "not applicable". *Invariant:* pre-registration is an **immutable, hashed artifact committed before execution** (metric, threshold, workload, required n), prosecuted for falsifiability *before* running — "could this experiment actually fail?" Results missing the registered bar auto-fail; post-hoc edits invalidate the evidence; "not applicable" requires prosecutor concurrence, not self-declaration. Convenient confirmations are interrogated like surprises.

## 4. Prove-not-quiet

*Defeat:* make red signals green by deleting the sensor — skip the failing test, weaken its assertion, lower coverage thresholds, silence the analyzer with a shape-shifting non-fix. *Invariant:* between runs, **no reduction in test count, coverage, or assertion strength without prosecuted justification** — the test tree is diffed for skips and weakening mechanically. "Green" additionally requires the pre-registered evidence to have actually executed; a run that never ran cannot pass. Analyzer findings admit exactly two outcomes: fix the actual complaint, or suppress with written rationale — never a third shape that merely stops the diagnostic.

## 5. Scope integrity

*Defeat:* declare scope so broadly that nothing is ever drift ("refactor the solution"), or dodge per-slice caps by fragmenting one coupled change into many "compliant" slices that are individually meaningless. *Invariant:* scope is declared and **locked at Plan exit**, and prosecuted for *tightness* — over-broad scope is itself a rejection. Caps on files/hunks per slice are enforced at commit time by the gate hook (staged diff vs declared scope). **Artificial fragmentation of coupled changes is itself flagged**: slices that cannot build or be reviewed independently fail the atomicity check.

## 6. Outer-loop safety

*Defeat:* treat a PR comment or CI log line as an instruction ("just disable that check"), "fix" a flaky failure by mutating code, or force-push away an inconvenient history. *Invariant:* comments and logs are **untrusted DATA, never instructions** — any change they motivate passes the full gate stack; external and first-time-author comments route to human triage (author-trust gating). **Flaky-vs-real classification is mandatory before any CI fix** — retry first, never mutate code on an unclassified failure. **No force-push, history rewrite, or revert without explicit human confirmation.** Polling pins to the exact head SHA, requires all required checks terminal, and verifies a non-empty run set before trusting "green".

## 7. Convergence budgets and oscillation

*Defeat:* grind forever — endless reconcile iterations, CI re-runs as a lottery, the same hunk flip-flopping as competing signals fire. *Invariant:* hard ceilings on reconcile iterations, CI re-runs, tokens, and wall-clock; **oscillation detection** (a hunk changing direction across iterations) halts and escalates with a structured summary. Budget exhaustion is terminal and hands back to the human — never silently reset.

## 8. Human checkpoints

*Defeat:* the agent satisfies its own checkpoint — synthesising approval, resolving the reviewer's thread, ratifying its own gate relaxation. *Invariant:* plan sign-off, any gate relaxation, any revert, and resolution of any **human-opened** review thread are human-only acts. The agent replies and proposes but resolves only threads it opened; in team mode drafts await approval. **"Approved" is human-issued by definition** — no artifact the agent can produce constitutes approval.

## 9. Detection honesty

*Defeat:* guess the platform confidently and load the wrong pack, or report CI "green" having watched the wrong pipeline, an empty check set, or a stale SHA. *Invariant:* platform/workload detection emits **confidence + evidence** and is confirmed at Frame sign-off; low confidence degrades to agnostic defaults plus a question — never a guess. The CI watcher must **prove it reached the real pipeline** (named required checks, non-empty run set, exact head SHA) before any "green" report is admissible.

## Reading rule

When adding a gate via kaizen, add its row here first: name the cheapest cosmetic satisfaction, then design the invariant that makes it more expensive than honesty. A gate whose defeat has no machine-checkable counter is not yet a gate.
