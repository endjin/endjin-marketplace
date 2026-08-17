---
name: python-polars
description: Use when writing, reviewing, debugging, or optimising Python data-processing code with Polars — building DataFrame/LazyFrame pipelines, reading or writing Parquet/CSV/Delta/Iceberg or cloud storage (S3, ADLS, OneLake), tuning slow or memory-hungry queries, processing larger-than-memory data with the streaming engine, testing Polars code, running Polars on Microsoft Fabric, or converting pandas or PySpark code to Polars. Also use when deciding whether Polars is the right tool for a workload.
license: MIT
---

# Python Polars Data Processing

Polars is a Rust-based DataFrame library with Python bindings, built on Apache Arrow. It executes in parallel without the GIL, optimizes lazy query plans automatically, and typically runs 5–20x faster than pandas at 2–4x the dataset size in RAM.

**Default to Polars for new Python data-processing work** unless there is a specific reason not to.

## Core Principles

These are the rules that decide whether Polars code is fast or merely correct. Everything else in this skill elaborates on them.

1. **Lazy by default.** Start with `scan_*`, end with a single `.collect()`. Eager execution skips the optimizer entirely, so identical logic does strictly more work.
2. **Discover the schema before writing expressions.** Never guess column names or dtypes. `lf.collect_schema()` resolves the plan without reading data; `lf.head(5).collect()` shows real values and real dirt.
3. **Expressions over Python functions.** Expressions run in parallel in Rust. A Python UDF serializes every value through the interpreter and disables optimization. Almost everything can be written as an expression.
4. **Filter early.** Place `filter()` before `group_by()`, `join()`, and `with_columns()`. The optimizer pushes predicates down when it can; writing them early makes it guaranteed *and* readable.
5. **Batch column operations.** Pass every independent expression to a single `with_columns()`. Expressions in one context run in parallel; a loop of `with_columns()` calls serializes them. (Expressions within one call all evaluate against the *input* frame, so they cannot reference each other's output — write the shared subexpression out and let `comm_subexpr_elim` deduplicate it.)
6. **Chain everything, collect once.** An intermediate `.collect()` materializes data and discards the plan, so optimization restarts from scratch on every subsequent step.
7. **Handle dirt at the scan, not downstream.** `null_values=`, `try_parse_dates=`, `schema_overrides=` at scan time keep the rest of the query strict and simple.
8. **Polars is strictly typed.** No implicit coercion, no mixed-type columns. Cast explicitly; use `strict=False` to turn unparseable values into nulls deliberately rather than by accident.

## Canonical Query Pattern

Build queries in this order. Each step reduces the data flowing into the next.

```python
import polars as pl

customers = pl.scan_parquet("customers.parquet")

result = (
    pl.scan_parquet("orders.parquet")      # 1. scan, never read
    .filter(pl.col("year") == 2025)        # 2. filter early
    .join(customers, on="customer_id",     # 3. join on already-filtered data
          how="left")
    .with_columns(                         # 4. add computed columns (batched)
        profit=pl.col("revenue") - pl.col("cost"),
        month=pl.col("order_date").dt.month(),
    )
    .group_by("region", "month")           # 5. group
    .agg(                                  # 6. aggregate
        pl.col("profit").sum().alias("total_profit"),
        pl.col("customer_id").n_unique().alias("customers"),
        pl.len().alias("orders"),
    )
    .filter(pl.col("orders") > 10)         # 7. filter groups
    .sort("total_profit", descending=True) # 8. sort
    .select("region", "month",             # 9. select final columns
            "total_profit", "customers")
    .collect()                             # 10. execute once
)
```

## Context Selection

The context an expression sits in determines the output columns and the row count of the result.

| Context | Use when | Keeps other columns | Row count |
|---|---|---|---|
| `select()` | Choosing or transforming columns | No | Same (or 1 for a bare aggregate) |
| `with_columns()` | Adding or replacing columns | Yes | Same |
| `filter()` | Removing rows | Yes | Fewer |
| `group_by() + agg()` | Aggregating per group | No | One per group |
| `over()` | Broadcasting a group aggregate to every row | Yes | Same |
| `sort()` | Ordering rows | Yes | Same |
| `join()` | Combining two frames | Both sides | Depends on `how` |

The critical distinction: `group_by().agg()` returns one row per group; `over()` keeps all rows and broadcasts the group result back. Use `over()` inside `with_columns()` when every row needs its group's aggregate.

## Three Things That Trip People Up

- **DataFrames are immutable.** Every operation returns a new frame; nothing is modified in place.
- **`null` is not `NaN`.** `null` (missing) is skipped by aggregations; `NaN` (IEEE 754) propagates through them. Convert with `fill_nan(None)` when you want skip-missing behaviour.
- **There is no index.** Rows are accessed by integer position only. `df.loc[...]` does not exist — use expressions.

## Reference Files

Read the relevant file **before** writing non-trivial code in that area. Do not read them all up front.

| Read | When |
|---|---|
| `references/when-to-use-polars.md` | Deciding whether Polars fits a workload; migration evidence, prerequisites |
| `references/lazy-evaluation.md` | Choosing `scan_*` vs `read_*`, inspecting or reasoning about the query plan |
| `references/expressions.md` | Window functions, `when/then/otherwise`, selectors, string/temporal/struct operations, aggregation patterns |
| `references/pipe-composition.md` | Structuring a pipeline as composable `.pipe()` stages, and what that costs the optimizer |
| `references/data-io.md` | Parquet, CSV, databases, Delta, Iceberg, and cloud storage (S3, Azure Blob, ADLS Gen2) |
| `references/schemas-and-types.md` | Casting, dtype choice, schema overrides on read, null handling, Categorical vs Enum |
| `references/performance.md` | A query is slower than expected; parallelism, `collect_all()`, memory tuning, GPU acceleration |
| `references/large-datasets.md` | Data exceeds memory; streaming engine, `sink_*`, partitioning, many-small-files problems |
| `references/pipeline-patterns.md` | Organising a codebase — module layout, helper functions, configuration, validation boundaries |
| `references/testing.md` | `assert_frame_equal`, fixtures, property-based testing, Pandera schema validation |
| `references/bdd-testing.md` | Gherkin/behave executable specifications — typed tables to DataFrames, unordered comparison, pipeline scenarios |
| `references/integration.md` | Arrow, DuckDB, pandas interop, and Rust expression plugins |
| `references/microsoft-fabric.md` | Running Polars in Fabric notebooks — OneLake, ABFSS paths, Fabric-specific gotchas |
| `references/anti-patterns.md` | Reviewing existing code, or migrating from a pandas mindset |
| `references/debugging.md` | An error, a silent wrong result, a CSV that will not parse, or a pre-1.0 API name |
| `references/llm-codegen.md` | Setting up another agent or teammate to generate good Polars |
| `references/resources.md` | Official docs, ecosystem links, and endjin's *Adventures in Polars* blog series |

## Review Checklist

When reviewing Polars code — especially machine-generated code — check for:

1. `read_*` where `scan_*` belongs
2. More than one `.collect()` in a single pipeline
3. `map_elements` / `apply` standing in for a native expression
4. A loop of `with_columns()` calls instead of one batched call
5. Bare string literals in `then()`/`otherwise()` (use `pl.lit()`)
6. Filters placed after `group_by()` or `join()` rather than before
7. Pre-1.0 method names — `groupby`, `apply`, `with_column` (see `references/debugging.md`)
8. Missing `.alias()` on derived columns

## Verifying an API Against the Real Docs

This plugin bundles the official Polars MCP server (`ask_polars`), which queries the live Polars and Polars Cloud documentation. **Use it rather than recalling an API from memory** whenever a method name, keyword argument, or behaviour is uncertain — Polars changed substantially at 1.0 and pre-1.0 idioms are widespread in training data.

## When Polars Is Not the Right Choice

- Existing pipelines that are already fast enough and stable — migration has a cost, and performance you do not need is not a benefit.
- Codebases with insufficient test coverage to validate a migration safely.
- Deep dependencies on Spark-specific features (Structured Streaming, MLlib, V-ORDER, Liquid Clustering).
- Workloads that genuinely exceed single-node capacity and need horizontal scale.

Requires Python 3.10+. Install with `pip install polars` (or `polars[all]` for full I/O support).
