# Code Organization and Pipeline Patterns

## Pipeline Functions

Structure data pipelines as pure functions that accept and return `LazyFrame`, composed with `.pipe()`. See [Functional Composition with `.pipe()`](pipe-composition.md#functional-composition-with-pipe) for the full treatment, including the query-optimizer implications and how to test stages.

```python
def clean_data(lf: pl.LazyFrame) -> pl.LazyFrame:
    return lf.with_columns(
        pl.col("name").str.strip_chars().str.to_lowercase(),
        pl.col("amount").fill_null(0).clip(lower_bound=0),
    ).filter(pl.col("status").is_not_null())


def enrich_data(lf: pl.LazyFrame) -> pl.LazyFrame:
    return lf.with_columns(
        quarter=pl.col("date").dt.quarter(),
        is_high_value=pl.col("amount") > 1000,
    )


def aggregate_metrics(lf: pl.LazyFrame) -> pl.LazyFrame:
    return lf.group_by("category", "quarter").agg(
        pl.col("amount").sum().alias("total"),
        pl.col("amount").mean().alias("avg"),
        pl.len().alias("count"),
    )


# Pipeline composition
result = (
    pl.scan_parquet("data.parquet")
    .pipe(clean_data)
    .pipe(enrich_data)
    .pipe(aggregate_metrics)
    .collect()
)
```

## Expression-Returning Helper Functions

For maximum parallelism, write functions that return expressions rather than transforming DataFrames. Multiple expressions returned this way can execute in parallel within a single `with_columns()`:

```python
from datetime import date


def compute_age() -> pl.Expr:
    return (
        (pl.lit(date.today()) - pl.col("birth_date"))
        .dt.total_days()
        .truediv(365.25)
        .cast(pl.Int32)
        .alias("age")
    )


def avg_age_by_gender(gender: str) -> pl.Expr:
    return (
        compute_age()
        .filter(pl.col("gender") == gender)
        .mean()
        .alias(f"avg_{gender}_age")
    )


# Expressions execute in parallel within with_columns
df = df.with_columns(compute_age())
```

## Layered Pipelines

For medallion-style architectures, model each layer transition as a composed stage and keep the whole transition lazy. Collect (or sink) only at the layer boundary, where the data is genuinely persisted.

```python
bronze_to_silver = compose(
    drop_test_records,
    conform_column_names,
    conform_types,
    deduplicate_by_natural_key,
)

silver_to_gold = compose(
    filter_to_reporting_period,
    derive_profitability,
    summarise_by_region,
)

# One lazy plan per layer transition; sink rather than collect for large outputs
(
    pl.scan_parquet("bronze/orders/*.parquet")
    .pipe(bronze_to_silver)
    .sink_parquet("silver/orders.parquet")
)
```

Validate at the boundary, not in the middle: run Pandera schema checks on the input to a layer and on its output, and let the interior of the pipeline stay strict and unchecked. See [Schema Validation with Pandera](testing.md#schema-validation-with-pandera).

## Best Practices

- Keep pipelines modular and lazy; collect only at the outermost boundary
- Group as many independent operations into a single `with_columns()` as possible
- Use expression-returning functions for single-column logic and `.pipe()` stages for pipeline phases
- Include validation at pipeline boundaries (input validation, output schema checks)
- Test each transformation function independently with small, focused DataFrames
- Annotate every stage `pl.LazyFrame -> pl.LazyFrame` and run a type checker in CI; this is what mechanically prevents a stray `.collect()` from breaking the plan
