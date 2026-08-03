# Idempotency and Replay Safety

Re-running must be safe. Anything that can be retried, resumed, or backfilled **will** be — by a scheduler recovering from a crash, an orchestrator retrying a task, an operator re-running yesterday's window, or the loop itself re-entering a phase after an interruption. Design every such operation to **converge**: running it twice, or resuming it from the middle, must land the system in the same state as one clean run. An operation that is only correct when executed exactly once from the beginning is a defect waiting for its first retry.

## Design for resume, not restart

A resumable operation records durable progress and continues from it; a restartable one throws work away and repeats it — at best wasting the work, at worst re-applying effects the first attempt already applied. Practical shape: partition the work into idempotent units (per key, per partition, per date-window), track completion durably per unit, and on re-entry skip or safely re-apply completed units. Checkpoints must be written *after* the unit's effect is durable, never before — a checkpoint ahead of its effect converts a crash into silent data loss; an effect ahead of its checkpoint merely costs one idempotent re-application.

Make the write path itself convergent: upserts keyed on natural identity rather than blind inserts; deterministic ids derived from content or key + window, never generated fresh per attempt (a fresh UUID per retry *manufactures* duplicates); absolute state ("set to X") over relative mutation ("increment by X") wherever the domain allows, because absolute writes are idempotent by construction.

## Run-twice-diff-zero: the test

The verification is mechanical and belongs in the evidence plan for any retriable operation: **run the operation twice; diff the resulting state; the diff must be zero.** Run the migration, then run it again — row counts, checksums, and content identical. Run the backfill for a window, then re-run the same window — no duplicates, no drift. Interrupt the job mid-flight, resume it, and diff against an uninterrupted run — identical. A non-zero diff is a failed gate, not a curiosity: it means the first production retry will corrupt state. This test is cheap, decisive, and pre-registerable — exactly what the evidence gate wants.

## Exactly-once-effective consumers

Delivery guarantees end at the transport: real systems deliver at-least-once, which means duplicates arrive. Exactly-once is achieved at the *effect*, not the delivery — consumers must be **exactly-once-effective**: processing the same message twice produces the effect once. The constructions: deduplicate on a stable message or event id persisted with the effect (ideally in the same transaction, so effect and dedup-record commit atomically); make the handler's effect naturally idempotent (upsert, absolute-state write); or gate side effects that cannot be deduplicated (emails, external API calls) behind an idempotency key the downstream honours. A consumer that increments, appends, or emits unconditionally on each delivery is incorrect under the transport's actual contract, however rarely the duplicate arrives in testing.

## Replay as a first-class capability

Replay is not only crash recovery — it is the correction mechanism for shipped data (forward-fix backfills), the migration mechanism for reprocessing history through new logic, and the audit mechanism for reproducing a past output. Systems built from convergent, resumable, exactly-once-effective operations get replay for free; systems that are not replay-safe forfeit all three and turn every incident into bespoke surgery. When reviewing any pipeline, job, or handler, ask the standing question: *what happens when this runs twice?* If the answer is anything but "the same thing", the node is not done.
