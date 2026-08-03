# Playbook: Data Incident

This is the forward-fix loop: bad data has already shipped, and you cannot unship data. Revert does not exist here — the response is triage, containment, correction, notification, and learning, in that order. Speed matters, but an unverified "fix" that reprocesses garbage is a second incident; every corrective step still travels through the gates, right-sized for urgency.

## Frame (triage)

Establish blast radius before touching anything: WHICH consumers read the bad data (walk the lineage graph downstream — reports, models, invoices, exported feeds), over WHICH time windows, and whether decisions or side effects were already taken on it (emails sent, payments made, models trained). Identify the contaminated partitions/keys precisely; "everything since Tuesday" is a triage failure that turns a scoped backfill into a full rebuild. Classify severity by consumer impact, not by row count — ten wrong rows in a billing feed outrank a million in a debug log.

## Plan and Execute

**Stop the bleeding first.** Pause the producing pipelines, circuit-break the contaminated outputs, quarantine the affected partitions, or mark datasets stale so consumers stop ingesting. Containment is its own slice with its own tiny gate ("is the bad flow actually stopped? show the paused run"), and it lands BEFORE root-cause analysis begins — diagnosis under continued contamination is bailing a boat mid-leak.

**Corrective backfill or restore-from-snapshot** is the fix. Choose restore when a clean snapshot predates the contamination and the delta can be replayed; choose corrective backfill when the fix must recompute. Either way the correction must be IDEMPOTENT (run-twice-diff-zero, rehearsed on a clone — the correction WILL be interrupted and re-run) and VERIFIED BY DATA-DIFF: pre-register the expected shape of the correction (which partitions change, expected counts/checksums/distributions), run it, diff actual against expected. A correction whose diff shows undeclared changes is stopped, not shipped. Root-cause the producing defect in parallel; the code fix follows the bug-fix playbook and must land before pipelines resume, or the backfill just re-contaminates.

**Consumer notification is a gate, not a courtesy.** Every consumer identified at triage gets told: what was wrong, which windows, what was corrected, and what they must do (re-run reports, retrain models, re-issue exports). Downstream copies of bad data survive your backfill; silent correction leaves consumers acting on data you know is wrong.

## Verify

Re-run the data-diff post-correction across the full affected window; run consumer contract tests and DQ checks against the corrected data; confirm resumed pipelines produce clean output for at least one full cycle before standing down.

## Kaizen (mandatory)

Every incident ends in a postmortem that feeds kaizen, and the central question is: WHICH GATE WOULD HAVE CAUGHT IT? Usually the answer is a missing contract test on a consumer boundary or a missing DQ check at the producer's exit (nulls, ranges, volume anomalies, schema drift). Five-whys to that gate; then every incident produces a NEW REGISTRY LENS PROPOSAL — the concrete check that makes this incident class impossible, filed as proposed for human ratification. An incident that produces no lens is a lesson rented, not owned; repeat-incident count after the lens activates is the killer metric.
