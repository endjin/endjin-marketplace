# Data engineering documents

How the rulebook applies to pipeline and platform documentation. Rule IDs refer to
`rules.md`.

## Pipeline documentation

Description first, operations second. For each pipeline, answer in this order:

1. **Purpose** — one topic sentence (D1): "This pipeline builds the daily
   customer-orders mart for the finance dashboard."
2. **Inputs and outputs** — tables/topics/buckets with schemas linked, owners named,
   and freshness expectations as values (W5): "Reads `raw.orders` (landed by 02:00
   UTC); writes `mart.daily_orders` (available by 04:00 UTC)."
3. **Schedule and triggers** — cron or event, time zone stated explicitly.
4. **Behavior under failure** — retries, idempotency, backfill semantics, in active
   voice with the agent named (V1): "The scheduler retries each task 3 times with
   exponential backoff. Reruns are idempotent: the job overwrites the partition for
   its logical date."
5. **SLA and alerting** — the number, and what fires when it is missed.

One name per object (W2): pick "pipeline", "job", or "DAG" and stay with it. Table
names, column names, and connection IDs are untouchable (M5).

## Runbooks

Instructions for a reader under stress (P4) — write for 3 a.m.

- Start from the alert: title the runbook with the alert name, and open with what the
  alert means in one sentence.
- Diagnosis before remedy, condition before command (V5): "If `lag_seconds` exceeds
  600, the consumer is stuck. Restart it with `kubectl rollout restart ...`."
- One action per numbered step (P1); expected result after each state-changing step
  (P2): "Run the backfill. The job prints one line per repaired partition."
- Repeat context instead of pointing backwards — a step must make sense on its own.
- Escalation is a step, not a footnote: name the on-call rotation and the trigger
  condition for paging it.
- Destructive operations get the warning shape (N1): "CAUTION: Do not run the backfill
  while the daily load runs. Concurrent writes corrupt the partition index."

## Data dictionaries

Description in table form. For each column give: name (verbatim, code-formatted), type,
meaning in one sentence, source or derivation, nullability with the reason null occurs,
and one example value.

- The meaning sentence follows D4 — a fact, not a synonym of the column name: for
  `order_ts`, not "The order timestamp" but "The time the customer submitted the order,
  in UTC, from the checkout service."
- State units in the meaning, not the name's imagination: "amount in minor currency
  units (pence)".
- One term per concept across the dictionary (W2): if `customer_id` means the same
  entity everywhere, the description says so; if not, the difference is stated.

## Incident reports (post-incident reviews)

Description, blameless, with a timeline.

- **Summary first** (D1): impact, duration, and cause in at most three sentences, with
  values: "Between 09:12 and 11:40 UTC on 2026-08-11, the orders API returned 500s for
  31% of requests. A schema migration locked the orders table."
- **Timeline** in ISO 8601 with time zone, one event per line, active voice with agents
  (V1): "09:12 — the deploy pipeline applied migration 0142. 09:14 — the pager fired."
- **Cause analysis**: name systems and decisions, not people. "The migration ran
  without a lock timeout" — not "the engineer forgot".
- **Actions**: each one an instruction with an owner and a date, not an aspiration:
  "Add a 5-second lock timeout to the migration template (owner: platform team, by
  2026-08-25)", not "We should be more careful with migrations."
- No vague reassurance ("we take reliability very seriously") — the actions are the
  reassurance.
