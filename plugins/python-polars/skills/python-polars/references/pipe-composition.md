# Functional Composition with `.pipe()`

Method chaining is the idiomatic Polars style, but a chain that runs to sixty lines is neither testable nor reviewable. `.pipe()` resolves the tension: it lets you name each stage of a transformation as a pure, independently testable function while keeping a single flat, readable chain.

```python
result = (
    pl.scan_parquet("orders/*.parquet")
    .pipe(select_reporting_period, year=2025)
    .pipe(conform_customer_fields)
    .pipe(derive_profitability)
    .pipe(summarise_by_region)
    .collect()
)
```

The chain reads as a description of the pipeline. Each stage is a function you can unit test in isolation with a five-row in-memory frame.

## The Stage Contract

Every stage takes a `LazyFrame` as its first argument and returns a `LazyFrame`. Annotate it, and let mypy or pyright enforce it — the type annotation is what stops a stray `.collect()` from silently destroying the query plan.

```python
def select_reporting_period(lf: pl.LazyFrame, *, year: int) -> pl.LazyFrame:
    """Keep only completed orders for the given reporting year."""
    return lf.filter(
        (pl.col("order_year") == year) & (pl.col("status") == "completed")
    )
```

Rules for a well-formed stage:

- Takes `pl.LazyFrame` first, returns `pl.LazyFrame`. Never a `DataFrame`.
- Pure: no I/O, no global state, no mutation of its argument (Polars frames are immutable anyway, which is what makes this natural).
- Keyword-only parameters after the frame, so `.pipe(fn, year=2025)` reads as prose at the call site.
- One responsibility, named for its business meaning (`select_reporting_period`), not its mechanics (`apply_filter_2`).

## Parameterised Stages

`.pipe(fn, **kwargs)` handles the common case. Use a closure or `functools.partial` when you need to build a list of pre-configured stages.

```python
from collections.abc import Callable
from functools import partial

Stage = Callable[[pl.LazyFrame], pl.LazyFrame]


# Direct: arguments forwarded by .pipe()
lf.pipe(select_reporting_period, year=2025)

# Closure: returns a configured Stage
def scale(column: str, factor: float) -> Stage:
    def _stage(lf: pl.LazyFrame) -> pl.LazyFrame:
        return lf.with_columns(pl.col(column) * factor)

    return _stage


lf.pipe(scale("amount", 1.2))

# partial: equivalent when the base function already takes the frame first
lf.pipe(partial(select_reporting_period, year=2025))
```

## Composing Stage Lists

When the set of stages is data-driven (configuration, feature flags, medallion layer), fold them into a single composed stage:

```python
import functools


def compose(*stages: Stage) -> Stage:
    """Left-to-right composition of LazyFrame stages."""

    def _composed(lf: pl.LazyFrame) -> pl.LazyFrame:
        return functools.reduce(lambda frame, stage: stage(frame), stages, lf)

    return _composed


bronze_to_silver = compose(
    drop_test_records,
    conform_customer_fields,
    conform_types,
)

result = pl.scan_parquet("bronze/*.parquet").pipe(bronze_to_silver).collect()
```

Because composition happens at plan-construction time, the composed pipeline produces exactly the same query plan as the equivalent explicit chain.

## Expression-Level `.pipe()`

`Expr.pipe()` exists too and composes the same way. Use it to build a vocabulary of reusable column-level logic:

```python
def as_percentage(expr: pl.Expr) -> pl.Expr:
    return (expr * 100).round(2)


def safe_divide(numerator: pl.Expr, denominator: pl.Expr) -> pl.Expr:
    return (
        pl.when(denominator != 0)
        .then(numerator / denominator)
        .otherwise(None)
    )


lf.with_columns(
    margin_pct=safe_divide(pl.col("profit"), pl.col("revenue")).pipe(as_percentage),
    tax_rate_pct=pl.col("tax_rate").pipe(as_percentage),
)
```

**Prefer expression-level helpers over frame-level stages when the logic concerns a single column.** Expressions compose inside one `with_columns()` and therefore execute in parallel; a frame-level stage per column does not. See [Expression-Returning Helper Functions](pipeline-patterns.md#expression-returning-helper-functions).

`DataFrame.pipe()` exists as well, for eager frames. There is no `Series.pipe()` — compose at the expression level instead.

## Schema-Dependent Stages: `pipe_with_schema()`

Some stages need the resolved schema — "cast every integer column to Float64", "unnest whatever struct columns exist". Calling `collect_schema()` inside a stage works, but resolves the plan at construction time on every invocation. `LazyFrame.pipe_with_schema()` defers the function to the plan stage and hands it the resolved schema:

```python
def conform_numeric_types(lf: pl.LazyFrame, schema: pl.Schema) -> pl.LazyFrame:
    return lf.with_columns(
        pl.col(name).cast(pl.Float64)
        for name, dtype in schema.items()
        if dtype.is_integer()
    )


lf.pipe_with_schema(conform_numeric_types)
```

> **Unstable API**: `pipe_with_schema()` is marked unstable and may change without that being treated as a breaking change. Exceptions it raises surface at plan time rather than at the call site, which makes them harder to locate. Prefer explicit schemas; reach for this only where dynamic schema logic genuinely earns its keep.

## What `.pipe()` Costs the Query Optimizer: Nothing

This is the question that matters for production pipelines, and the answer is unambiguous. `LazyFrame.pipe` is implemented as:

```python
def pipe(self, function, *args, **kwargs):
    return function(self, *args, **kwargs)
```

It is pure syntactic sugar, evaluated in Python at **plan-construction time**. It adds no node to the logical plan, introduces no runtime indirection, and costs nothing at execution time. The intermediate representation handed to the optimizer is identical to the same operations written inline.

Every optimization therefore behaves exactly as it would in a monolithic chain:

- Predicate pushdown still moves a `filter()` written in the fifth stage down into the scan, provided it references source columns.
- Projection pushdown still reads only the columns the final `select()` needs.
- Common subplan and subexpression elimination still fire across stage boundaries.
- `cluster_with_columns` still reassociates independent `with_columns()` calls.

This is verifiable, and worth asserting in a test for any performance-sensitive pipeline:

```python
def test_pipe_decomposition_preserves_the_query_plan():
    source = pl.scan_parquet("orders/*.parquet")

    piped = (
        source
        .pipe(select_reporting_period, year=2025)
        .pipe(derive_profitability)
    )
    inlined = source.filter(
        (pl.col("order_year") == 2025) & (pl.col("status") == "completed")
    ).with_columns(profit=pl.col("revenue") - pl.col("cost"))

    assert piped.explain() == inlined.explain()
```

## What Does Break Optimization

`.pipe()` is free. The things people put *inside* pipe stages are not. These are the real hazards, in descending order of damage:

| Hazard | Effect | Fix |
|---|---|---|
| `.collect()` inside a stage | Materializes data and discards the plan. Every later stage optimizes from scratch against an eager frame. The single biggest self-inflicted wound in a piped pipeline. | Return `LazyFrame`; collect once at the outermost boundary. Enforce with type annotations plus a type checker in CI. |
| Stage returns a `DataFrame` | Same as above, but silently — the chain keeps working because `DataFrame` has most of the same methods. | Annotate `-> pl.LazyFrame` and run a type checker. |
| `LazyFrame.map_batches()` or `Expr.map_elements()` in a stage | Opaque Python node; the optimizer cannot push predicates or projections through it. Everything upstream of the barrier loses pushdown. | Express natively. If genuinely unavoidable, place it as late in the chain as possible and set `is_elementwise=True` on `Expr.map_batches` when the function truly is element-wise. |
| `collect_schema()` in every stage | Forces plan resolution repeatedly at construction time; O(stages) overhead, noticeable on wide schemas and long pipelines. | Resolve the schema once at the top of the pipeline, or use `pipe_with_schema()`. |
| Fragmenting independent `with_columns()` across many stages | Splits one parallel context into several sequential plan nodes. | Decompose by phase, not by column — see below. |
| `.cache()` inserted "to be safe" | Forces materialization of a subplan; usually redundant because `comm_subplan_elim` already handles shared subtrees. | Remove it and use `pl.collect_all()` for genuinely shared bases. |

## Stage Granularity: Decompose by Phase, Not by Column

This is the one genuine design tension in a `.pipe()`-based architecture. Independent expressions inside a single `with_columns()` run in parallel; spread across several stages they become separate plan nodes.

Polars mitigates this. The lazy optimizer runs a **`cluster_with_columns`** pass whose job is precisely to *"cluster sequential `with_columns` calls to independent calls"*. So splitting is usually recovered automatically — but only for genuinely independent expressions, and only in lazy mode. Do not treat it as licence to fragment.

The design rule:

- **Decompose by pipeline phase**: `clean` → `conform` → `enrich` → `aggregate`. Each phase is a meaningful, independently testable unit that maps onto something a reviewer recognises.
- **Do not decompose by column.** One stage per derived column produces a long tail of trivial plan nodes, an unreadable call site, and a test suite that tests the framework rather than the logic.
- **Within a stage, batch aggressively.** Every independent expression goes into a single `with_columns()`.
- **Verify with `explain()`** when a pipeline is performance-sensitive.

```python
# GOOD: a phase-level stage with one parallel context inside
def derive_profitability(lf: pl.LazyFrame) -> pl.LazyFrame:
    return lf.with_columns(
        profit=pl.col("revenue") - pl.col("cost"),
        margin_pct=safe_divide(
            pl.col("revenue") - pl.col("cost"), pl.col("revenue")
        ).pipe(as_percentage),
        is_high_value=pl.col("revenue") > 1000,
    )


# BAD: one stage per column -- fragments the plan and reads worse
lf.pipe(add_profit).pipe(add_margin).pipe(add_high_value_flag)
```

## Observability Without Breaking the Chain

An identity stage is a clean place to log or assert mid-pipeline. Keep it lazy: log the *schema*, never the data.

```python
import logging

logger = logging.getLogger(__name__)


def trace(lf: pl.LazyFrame, *, label: str) -> pl.LazyFrame:
    """Identity stage. Logs the resolved schema; adds no node to the plan."""
    logger.debug("%s -> %s", label, lf.collect_schema())
    return lf


result = (
    pl.scan_parquet("orders/*.parquet")
    .pipe(clean)
    .pipe(trace, label="after clean")
    .pipe(enrich)
    .collect()
)
```

> **Warning**: Never put `.collect()` or `.head(n).collect()` in a trace stage in production code — it executes the plan built so far, on every run. Gate that kind of probe behind an explicit debug flag, or use it only at the REPL.

## Testing Stages

The payoff for the stage contract is that each stage is a pure function with a trivial signature. Test it with a small in-memory frame: no I/O, no fixtures, no test doubles.

```python
from polars.testing import assert_frame_equal


def test_select_reporting_period_excludes_other_years_and_statuses():
    lf = pl.LazyFrame(
        {
            "order_year": [2024, 2025, 2025],
            "status": ["completed", "completed", "cancelled"],
        }
    )

    result = lf.pipe(select_reporting_period, year=2025).collect()

    assert_frame_equal(
        result,
        pl.DataFrame({"order_year": [2025], "status": ["completed"]}),
    )
```

Test the *composition* separately and sparingly — a single end-to-end test over a representative sample, plus the plan-equivalence test above where performance matters.
