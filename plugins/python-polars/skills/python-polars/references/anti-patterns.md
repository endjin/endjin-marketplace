# Common Anti-Patterns

## Row-by-Row Iteration

```python
# BAD: Row-by-row iteration (pandas mindset)
results = []
for row in df.iter_rows(named=True):
    results.append(row["a"] * 2 + row["b"])

# GOOD: Columnar expression
df.with_columns(result=pl.col("a") * 2 + pl.col("b"))
```

## Python UDFs for Native Operations

```python
# BAD: Python lambda for string operations
df.with_columns(pl.col("text").map_elements(lambda x: x.upper().strip()))

# GOOD: Native string expressions (Rust, parallelizable)
df.with_columns(pl.col("text").str.to_uppercase().str.strip_chars())
```

## Sequential with_columns Calls

```python
# BAD: Forces sequential execution
df = df.with_columns(a_doubled=pl.col("a") * 2)
df = df.with_columns(b_tripled=pl.col("b") * 3)

# GOOD: Parallel execution
df = df.with_columns(
    a_doubled=pl.col("a") * 2,
    b_tripled=pl.col("b") * 3,
)
```

## Eager Mode for Large Data

```python
# BAD: Loads entire file into memory immediately
df = pl.read_parquet("huge_file.parquet")
result = df.filter(pl.col("x") > 5).select("a", "b")

# GOOD: Lazy mode with automatic optimizations
result = (
    pl.scan_parquet("huge_file.parquet")
    .filter(pl.col("x") > 5)
    .select("a", "b")
    .collect()
)
```

## Unnecessary Pandas Conversion

```python
# BAD: Roundtripping through pandas
pandas_df = df.to_pandas()
result = pandas_df.groupby("cat").agg({"val": "mean"})
result = pl.from_pandas(result)

# GOOD: Stay in Polars
result = df.group_by("cat").agg(pl.col("val").mean())
```

## Manual Column Enumeration

```python
# BAD: Listing every column manually
df.with_columns(
    pl.col("col_1").fill_null(0),
    pl.col("col_2").fill_null(0),
    pl.col("col_3").fill_null(0),
)

# GOOD: Column selectors
import polars.selectors as cs
df.with_columns(cs.numeric().fill_null(0))
```

## Multiple Separate collect() on Related Queries

```python
# BAD: Each collect() re-scans the data
base = pl.scan_parquet("data.parquet").filter(pl.col("year") == 2025)
result_a = base.group_by("region").agg(pl.col("sales").sum()).collect()
result_b = base.group_by("product").agg(pl.col("sales").mean()).collect()

# GOOD: Single execution with shared subplan caching
result_a, result_b = pl.collect_all([
    base.group_by("region").agg(pl.col("sales").sum()),
    base.group_by("product").agg(pl.col("sales").mean()),
])
```

## Relying on Row Index

```python
# BAD: Pandas-style index-based access
# df.loc[...]  -- does not exist in Polars

# GOOD: Use expressions
df.filter(pl.col("id") == target_id)
df.head(10)
```

## Collecting Too Early

```python
# BAD: Collecting mid-pipeline breaks optimization
df = pl.scan_parquet("data.parquet").collect()  # Materializes everything
result = df.lazy().filter(pl.col("x") > 5).select("a", "b").collect()

# GOOD: Keep the full pipeline lazy
result = (
    pl.scan_parquet("data.parquet")
    .filter(pl.col("x") > 5)
    .select("a", "b")
    .collect()  # Single collect at the end
)
```

## Collecting Inside a Pipe Stage

```python
# BAD: the stage returns a DataFrame, severing the plan for everything downstream
def enrich(lf: pl.LazyFrame) -> pl.DataFrame:
    return lf.with_columns(quarter=pl.col("date").dt.quarter()).collect()

# GOOD: stages stay lazy; collect once at the boundary
def enrich(lf: pl.LazyFrame) -> pl.LazyFrame:
    return lf.with_columns(quarter=pl.col("date").dt.quarter())
```

This fails quietly because `DataFrame` supports most of the same methods, so the chain keeps working — just without any cross-stage optimization. Annotate every stage and run a type checker.

## One Pipe Stage per Derived Column

```python
# BAD: fragments a single parallel context into a chain of plan nodes
lf.pipe(add_profit).pipe(add_margin).pipe(add_high_value_flag)

# GOOD: one phase-level stage, one batched with_columns
def derive_profitability(lf: pl.LazyFrame) -> pl.LazyFrame:
    return lf.with_columns(
        profit=pl.col("revenue") - pl.col("cost"),
        margin=(pl.col("revenue") - pl.col("cost")) / pl.col("revenue"),
        is_high_value=pl.col("revenue") > 1000,
    )
```

> Note the repeated subexpression in `margin`: expressions in a single `with_columns()` all evaluate against the *input* frame, so `margin` cannot reference the `profit` column being created alongside it. Write the expression out — `comm_subexpr_elim` deduplicates the shared computation in the optimizer, so there is no redundant work.

## Using String Types for Low-Cardinality Columns

```python
# BAD: String columns waste memory for repeated values
df = pl.read_csv("data.csv")  # "status" column stays as pl.String

# GOOD: Cast to Categorical or Enum
df = pl.read_csv(
    "data.csv",
    schema_overrides={"status": pl.Categorical},
)
```
