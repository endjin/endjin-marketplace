# Schema Management and Type Handling

## Type Casting

```python
# Strict mode (default): raises error on failed conversion
df.with_columns(pl.col("price").cast(pl.Float64))

# Non-strict: failed conversions become null
df.with_columns(pl.col("price").cast(pl.Float64, strict=False))

# Downcast to save memory
df.with_columns(
    pl.col("count").cast(pl.Int32),
    pl.col("ratio").cast(pl.Float32),
)

# Auto-shrink to minimal dtype that fits the data
df.with_columns(pl.col("count").shrink_dtype())

# String to datetime (uses Rust chrono format specifiers, NOT Python strftime)
df.with_columns(
    pl.col("date_str").str.to_datetime("%Y-%m-%d %H:%M:%S")
)
```

> **Note on chrono vs strftime**: Polars uses Rust chrono format specifiers, which differ from Python's `strftime` in key ways. Most notably, `%f` in chrono is nanoseconds (9 digits, zero-padded right), whereas in Python it is microseconds (6 digits). Use `%.3f` for milliseconds or `%.6f` for microseconds. The `%q` specifier (quarter) is available in chrono but not in Python's `strftime`.

## Notable Data Types

| Type | Description | Use Case |
|---|---|---|
| `pl.String` | UTF-8 string (formerly `pl.Utf8`) | Text data |
| `pl.Categorical` | Dictionary-encoded string | Low-cardinality string columns |
| `pl.Enum(categories)` | Fixed-set categorical | Known set of valid values |
| `pl.Decimal(precision, scale)` | 128-bit decimal arithmetic | Financial data, exact arithmetic |
| `pl.Int128` | 128-bit integer (~±1.7e38 range) | Very large integers |
| `pl.Date` / `pl.Datetime` / `pl.Duration` | Temporal types | Date/time data |
| `pl.List(inner)` | Variable-length lists | Nested data |
| `pl.Struct(fields)` | Named fields | Record-like nested data |

## Schema Overrides on Read

```python
df = pl.read_csv(
    "data.csv",
    schema_overrides={
        "id": pl.Int64,
        "amount": pl.Float64,
        "date": pl.Date,
        "category": pl.Categorical,
    },
    infer_schema_length=10000,
)
```

## Null Handling

```python
# Fill strategies
df.with_columns(
    pl.col("value").fill_null(0),                        # Constant
    pl.col("value").fill_null(pl.col("default_value")),  # From another column
    pl.col("value").fill_null(strategy="forward"),        # Forward fill
    pl.col("value").fill_null(strategy="backward"),       # Backward fill
    pl.col("value").interpolate(),                        # Linear interpolation
)

# Counting and detecting nulls
df.select(pl.col("value").null_count())
df.with_columns(pl.col("value").is_null().alias("is_missing"))

# Drop nulls
df.drop_nulls()
df.drop_nulls(subset=["col_a", "col_b"])
```

## Categorical Data

Use `pl.Categorical` for low-cardinality string columns to reduce memory and speed up group-by operations:

```python
df.with_columns(pl.col("status").cast(pl.Categorical))
```

Use `pl.Enum` when the set of valid values is known upfront for stricter validation. Prefer `Enum` over `Categorical` whenever categories are known at pipeline design time:

```python
status_type = pl.Enum(["active", "inactive", "pending"])
df.with_columns(pl.col("status").cast(status_type))
```

> **Note**: Comparing `Categorical` columns created independently requires a `StringCache` context, adding overhead. `Enum` avoids this since categories are fixed. All categorical comparisons now use lexical ordering (the `ordering` parameter was deprecated in v1.32).
