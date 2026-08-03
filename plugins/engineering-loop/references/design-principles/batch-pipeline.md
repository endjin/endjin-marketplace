# Design Principles: Batch Pipeline

Load this pack when the change involves scheduled or triggered data processing: ETL/ELT jobs, warehouse transforms, orchestrated DAGs, report generation.

**Every task must be idempotent and replayable.** Batch tasks WILL be re-run: on failure, on backfill, on retry after a half-write, by an operator at 3am. Re-running any task with the same inputs must converge to the same state — overwrite-by-partition, MERGE by key, delete-and-insert within the task's declared slice; never blind append. The test is run-twice-diff-zero, and it belongs in the task's own test suite, not in operator folklore.

**Late, duplicate, and malformed data are the normal case.** Upstream will deliver events out of order, twice, and occasionally garbled — design for it as input contract, not incident. Separate event-time from processing-time explicitly; define the lateness horizon and what happens beyond it (reprocess the partition, dead-letter, drop with a metric). Malformed rows go to quarantine with provenance, never silently dropped — a silent drop is data loss wearing a robustness costume.

**Freshness is an SLA, measured, not an aspiration.** Declare, per output dataset: expected arrival, maximum staleness, and who is paged when it is missed. "The job usually finishes by 6" is not an SLA. Publish freshness as metadata consumers can check, so a stale dataset announces itself instead of being discovered in a wrong report.

**Process partition-aware.** The partition (day, hour, tenant, key range) is the unit of processing, reprocessing, and reasoning. A task that declares which partitions it reads and writes gets incremental runs, targeted backfills, safe parallelism, and a meaningful drift-audit (did the run touch only its declared partitions?). A task that scans everything to rebuild everything gets none of these and costs a full rebuild per bug.

**Backfill semantics are designed up front, not improvised.** State how history is reprocessed: which partitions, in what order, with WHICH code and config version (running today's logic over 2023 data is a semantic decision — make it explicitly), and how consumers are told history changed. Backfills obey the same idempotency and DQ gates as scheduled runs.

**Data-quality checks at every boundary.** Validate on ingest (schema, nulls, ranges, volume-anomaly) and on publish (row counts vs expected, referential integrity, distribution guardrails). A DQ failure BLOCKS the downstream, loudly — propagating known-bad data to make the DAG green is the pipeline equivalent of silencing a failing test.

**Cost per run is a tracked metric.** Compute and storage per pipeline, watched for trend, reviewed like latency: an accidental full-table rescan is a regression even when the output is perfect. Cheap-and-correct beats correct alone — and you can only manage what you measure.
