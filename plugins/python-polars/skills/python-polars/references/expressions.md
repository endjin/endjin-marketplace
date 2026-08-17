# Core Concepts

## Expression System

Expressions are the fundamental abstraction in Polars -- functional mappings from `Series` to `Series`. They are:

- **Parallel**: Multiple expressions within a single context (`select`, `with_columns`, `agg`) execute concurrently
- **Optimizable**: The query planner rewrites, reorders, and simplifies expressions automatically
- **Composable**: Expressions chain fluently and transfer across contexts
- **Columnar**: Operations apply to entire columns, not individual rows

```python
import polars as pl

# Expressions compose naturally
df.with_columns(
    normalized=pl.col("amount") / pl.col("amount").max(),
    category_upper=pl.col("category").str.to_uppercase(),
    is_high_value=pl.col("amount") > 1000,
)
```

## DataFrames Are Immutable

Polars DataFrames are immutable. Every operation returns a new DataFrame rather than modifying in place. This enables safe parallelism and makes pipelines easier to reason about.

```python
# Each operation returns a new DataFrame
df2 = df.with_columns(new_col=pl.col("a") * 2)
# df is unchanged; df2 has the new column
```

## Null vs NaN

Polars distinguishes between `null` (missing data) and `NaN` (IEEE 754 floating-point not-a-number):

- **null** is skipped by aggregations (`mean`, `sum`, `min`, `max`)
- **NaN** propagates through aggregations and can produce unexpected results
- Always convert NaN to null with `fill_nan(None)` when you want skip-missing behavior

```python
df.with_columns(
    pl.col("ratio").fill_nan(None),  # Convert NaN to null for correct aggregation
)
```

# Expression API

## Chaining Expressions

```python
df.with_columns(
    pl.col("name")
        .str.to_lowercase()
        .str.strip_chars()
        .str.replace_all(r"\s+", "_")
        .alias("clean_name"),
    pl.col("amount")
        .fill_null(0)
        .clip(lower_bound=0)
        .alias("clean_amount"),
)
```

## Conditional Logic with When/Then/Otherwise

```python
df.with_columns(
    pl.when(pl.col("score") >= 90)
    .then(pl.lit("A"))
    .when(pl.col("score") >= 80)
    .then(pl.lit("B"))
    .when(pl.col("score") >= 70)
    .then(pl.lit("C"))
    .otherwise(pl.lit("F"))
    .alias("grade")
)
```

> **Note**: Polars evaluates all branches of `when/then/otherwise` in parallel and filters afterward. Each expression must be valid on its own, regardless of conditions.

## Window Functions (.over())

Window functions compute group-level statistics while preserving the original row structure:

```python
df.with_columns(
    group_mean=pl.col("amount").mean().over("category"),
    rank_in_group=pl.col("amount").rank("dense", descending=True).over("category"),
    pct_of_group=pl.col("amount") / pl.col("amount").sum().over("category"),
)
```

**Mapping strategies** control how results map back to rows:

| Strategy | Behavior | Performance |
|---|---|---|
| `"group_to_rows"` | Maintains original row order (default) | Slower |
| `"explode"` | Groups rows together by partition | Faster |
| `"join"` | Broadcasts aggregated values as lists | Specialized |

```python
# Use "explode" when row order doesn't matter for better performance
df.with_columns(
    pl.col("amount").rank().over("category", mapping_strategy="explode")
)
```

## Horizontal Operations

```python
df.with_columns(
    total=pl.sum_horizontal("col_a", "col_b", "col_c"),
    any_null=pl.any_horizontal(pl.col("col_a", "col_b", "col_c").is_null()),
    row_max=pl.max_horizontal("col_a", "col_b", "col_c"),
)
```

## Column Selectors

Use `polars.selectors` for batch operations on columns by type or name pattern:

```python
import polars.selectors as cs

# Apply transformation to all numeric columns at once
df.with_columns(cs.numeric().fill_null(0))

# Select all string columns
df.select(cs.string())

# Aggregate all integers in a group_by
df.group_by("category").agg(cs.integer().sum())

# Exclude specific patterns
df.select(cs.all() - cs.matches("^_temp"))
```

## Aggregation Patterns

```python
# Multiple aggregations in a single group_by
df.group_by("category").agg(
    pl.col("amount").sum().alias("total"),
    pl.col("amount").mean().alias("avg"),
    pl.col("amount").std().alias("std"),
    pl.len().alias("count"),
    pl.col("customer_id").n_unique().alias("unique_customers"),
)

# Conditional aggregation
df.group_by("region").agg(
    (pl.col("status") == "active").sum().alias("active_count"),
    pl.col("revenue").filter(pl.col("status") == "active").sum().alias("active_revenue"),
)

# Sorting within groups
df.group_by("department").agg(
    pl.col("name").sort().first().alias("first_alphabetically"),
    pl.col("salary").sort(descending=True).head(3).alias("top_3_salaries"),
)
```

## String Operations

The string namespace (`str`) provides 40+ native methods. Notable operations beyond basic transforms:

```python
df.with_columns(
    # Multi-pattern matching (Aho-Corasick, literal only -- faster than regex)
    has_keyword=pl.col("text").str.contains_any(["error", "warning", "critical"]),

    # Multi-pattern replacement (Aho-Corasick, literal only)
    cleaned=pl.col("text").str.replace_many(
        ["é", "ñ", "ü"], ["e", "n", "u"]
    ),

    # First/last N characters
    prefix=pl.col("code").str.head(3),
    suffix=pl.col("code").str.tail(4),

    # Parse integers with configurable base
    hex_value=pl.col("hex_str").str.to_integer(base=16),

    # Extract named regex groups into a struct
    parsed=pl.col("log_line").str.extract_groups(
        r"(?P<timestamp>\d{4}-\d{2}-\d{2}) (?P<level>\w+)"
    ),
)
```

## Temporal Operations

```python
from datetime import date

df.with_columns(
    quarter=pl.col("date").dt.quarter(),
    week=pl.col("date").dt.week(),
    day_name=pl.col("date").dt.to_string("%A"),

    # Business day arithmetic
    next_business_day=pl.col("date").dt.add_business_days(1),
    custom_workweek=pl.col("date").dt.add_business_days(
        5,
        week_mask=(True, True, True, True, True, False, False),
        holidays=[date(2025, 12, 25), date(2025, 1, 1)],
    ),
)

# Count business days between two date columns
df.with_columns(
    working_days=pl.business_day_count("start_date", "end_date"),
)
```

## Struct and Nested Data

```python
# Create structs from multiple columns
df.with_columns(
    address=pl.struct("street", "city", "state", "zip")
)

# Unnest structs back to columns
df.unnest("address")

# Explode list columns into individual rows
df.explode("tags")
```
