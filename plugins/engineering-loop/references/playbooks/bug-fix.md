# Playbook: Bug Fix

## Frame

Clarify what "fixed" observably means before anything else: the exact reproduction, the expected behaviour, and where the two diverge. Capture blast radius — who else hits this path, since when, and whether bad output has already escaped (if data shipped, fork to the data-incident playbook). Most fixes are Tier 0/1; escalate when the defect implicates shared infrastructure, security, or persisted state.

## Plan

Reproduce BEFORE fixing. The failing test IS the pre-registered evidence: written first, it fails for the reason the bug report describes, and its transition red→green is the falsifiable validation of the fix. A fix without a prior reproduction is a hypothesis you never tested — you may have fixed a different bug, or nothing. If the bug is timing-, environment-, or data-dependent and a deterministic test is genuinely impossible, pre-register the next-best observation (a log assertion, a statistical rerun count) and say so explicitly; do not silently downgrade to "seems fine now".

Root-cause versus symptom is the honest binary, and the Plan gate demands you declare which side you are on. Five-whys the failure to its cause. Then choose one of exactly two honest responses: fix the root, or patch the symptom **with recorded justification** (root fix is disproportionate, scheduled follow-up filed, mitigation is safe). What is never acceptable is the third, dishonest option: making the signal go away — deleting the failing assertion, widening a tolerance, catching-and-ignoring, suppressing the warning. Silencing is worse than ignoring, because it also blinds the next person. Prove-not-quiet applies: the diff must show the cause addressed, not the detector muted.

Sweep siblings. A root cause rarely has one instance: search for the same pattern elsewhere before declaring scope, and either include the siblings or explicitly defer them with a note. Fixing one of five copies is a symptom-level fix wearing a root-cause costume.

## Execute

The fix and its regression test travel in ONE atomic slice — the test is not a follow-up, it is the fix's evidence artifact and its permanent guard (an *artifact* in `evidence/<node>/`, not the evidence *gate*: no evidence verdict is recorded for a claim-free fix — its hash rides in the gauntlet verdict). Keep the slice minimal: no opportunistic refactoring, no drive-by cleanups; if the fix exposes needed refactoring, that is a separate, subsequent changeset. The red→green demonstration must be **observed and recorded**: run the new/updated test against the pre-fix code (red), then against the fixed code (green). When an existing test pinned the wrong behaviour, the parent commit is legitimately green and the red state exists only in the working tree — record the observation in the slice's evidence rather than demanding an unsatisfiable red commit in history.

## Verify

Run the new test (green), then the full gauntlet at full strictness — a fix that breaks something else is a new defect, not a smaller one. Confirm no reduction in test count or assertion strength anywhere in the diff. If the bug was observed in production, verify the fix against the production-shaped case, not just the minimal reproduction.

## Self-review and Reconcile

Prosecute the diff with one question leading: does this address the cause the five-whys found, or does it intercept the symptom downstream? Cite the line that fixes the cause.

## Kaizen

Every bug is a process escape: some gate should have caught it and did not. Name the gate — a missing test class, an analyzer not enabled, a review lens absent, a contract untested — and emit a lesson record proposing the tightening. The class of bug, not the instance, is what kaizen retires. If the same defect class fires again after the gate lands, that is the killer metric: the gate failed, and the gate itself becomes the bug.
