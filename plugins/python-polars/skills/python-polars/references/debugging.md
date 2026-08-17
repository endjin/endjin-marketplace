# Error Handling and Debugging

## Common Error Types

| Error Type | When It Occurs |
|---|---|
| `ComputeError` | Failed computation (type mismatch, overflow) |
| `SchemaError` | Schema mismatch (wrong column count, incompatible types) |
| `InvalidOperationError` | Operation not valid for the given data types or context |
| `ColumnNotFoundError` | Referenced column does not exist |
| `DuplicateError` | Duplicate column names in `select` / `with_columns` |
| `ShapeError` | Shape mismatch in data (e.g., mismatched lengths in `from_dict`) |
| `OutOfBoundsError` | Index out of bounds |
| `StructFieldNotFoundError` | Specified struct field not found |
| `StringCacheMismatchError` | Comparing `Categorical` columns from different sources without `StringCache` |

## Silent Failure Modes

These produce wrong answers rather than errors, which makes them the most expensive class of bug in a Polars pipeline. Every one of them is a routine mistake.

**Strings in `then()`/`otherwise()` are column names, not values.**

```python
# BAD: reads a column called "adult" (or raises ColumnNotFoundError)
pl.when(pl.col("age") >= 18).then("adult").otherwise("minor")

# GOOD: wrap literals
pl.when(pl.col("age") >= 18).then(pl.lit("adult")).otherwise(pl.lit("minor"))
```

**Null comparisons drop rows silently.** `null > 2` evaluates to null, which `filter()` treats as false.

```python
# BAD: silently excludes every row where "value" is null
df.filter(pl.col("value") > 2)

# GOOD: be explicit about null rows
df.filter((pl.col("value") > 2) | pl.col("value").is_null())
```

**A bare aggregation in `with_columns()` broadcasts the global value.** It does not error, it just fills the column with the overall figure.

```python
# BAD: every row gets the overall mean
df.with_columns(avg=pl.col("value").mean())

# GOOD: per-group value aligned to each row
df.with_columns(avg=pl.col("value").mean().over("category"))
```

**Nulls do not match in joins by default**, so rows with null keys drop silently out of inner joins.

```python
df.join(other, on="customer_id", how="inner", nulls_equal=True)
```

**A left join with a non-unique right key fans out the left side.** More rows after a join means duplicate keys on the right — check the row count, and check `result.null_count()` after a left join.

**Use `&`, `|`, `~` with parentheses around each condition.** Python's `and`/`or`/`not` raise on expressions, and without parentheses operator precedence binds the comparison wrongly.

```python
df.filter((pl.col("a") > 1) & (pl.col("b") < 5))
```

**Duplicate output names raise `DuplicateError`.** A computed column keeps its source name, so always `.alias()` derived columns.

```python
# BAD: two columns named "price"
df.select(pl.col("price"), pl.col("price") * 1.1)

# GOOD
df.select(pl.col("price"), (pl.col("price") * 1.1).alias("price_adjusted"))
```

**Regex column selection requires anchors.** `pl.col("^sales_.*$")` is treated as a regex; `pl.col("sales_.*")` is treated as a literal column name.

## Debugging Strategies

```python
# Inspect the optimized query plan before executing
print(query.explain())

# Visualize the execution graph
query.show_graph()

# Check schema without executing
print(query.collect_schema())

# Find problematic values during type casting
df.with_columns(
    pl.col("amount").cast(pl.Float64, strict=False).alias("amount_clean")
).filter(pl.col("amount_clean").is_null() & pl.col("amount").is_not_null())
```

## CSV Parsing Issues

```python
df = pl.read_csv(
    "data.csv",
    infer_schema_length=10000,
    truncate_ragged_lines=True,
    ignore_errors=True,
    null_values=["NA", "N/A", "", "null"],
    schema_overrides={"problematic_col": pl.String},
)
```

## Common Pitfalls

- **Mixing null and NaN**: NaN propagates through aggregations; null is skipped. Always `fill_nan(None)` before aggregating if you want skip behavior
- **Chrono vs strftime format strings**: Polars uses Rust chrono format specifiers for date parsing. Key difference: `%f` is nanoseconds in chrono (9 digits) vs microseconds in Python (6 digits). Use `%.3f` / `%.6f` for explicit precision
- **Assuming group_by order**: Group-by results have no guaranteed order; always `.sort()` explicitly
- **Expecting in-place mutation**: Polars DataFrames are immutable; operations return new DataFrames
- **Using deprecated `pl.Utf8`**: Use `pl.String` instead (renamed in v1.0; `pl.Utf8` remains as an alias but should not be used in new code)
- **Insufficient `infer_schema_length` for CSVs**: The default may not sample enough rows, leading to incorrect type inference. Specify a higher value (e.g., `10000`) or use `schema_overrides`

## API Currency

The API moved significantly at v1.0, and pre-1.0 spellings persist in blog posts, Stack Overflow answers, and LLM training data. Verify anything you are not certain about rather than trusting memory.

| Outdated | Current |
|---|---|
| `df.apply(...)` | Removed; use expressions, or `map_batches` as a last resort |
| `str.lengths()` | `str.len_chars()` (or `str.len_bytes()`) |
| `list.lengths()` | `list.len()` |
| `pl.NUMERIC_DTYPES` | `polars.selectors` (`cs.numeric()`) |
| `pl.Utf8` | `pl.String` (alias retained, but do not use in new code) |
| `collect(streaming=True)` | `collect(engine="streaming")` |
| `groupby` | `group_by` (and every other pandas spelling — there is no index, no `.loc`, no `.iloc`) |
| `Categorical(ordering=...)` | Removed in v1.32; all categorical comparisons use lexical ordering |
| `QueryOptFlags(collapse_joins=...)` | Deprecated; handled by `predicate_pushdown` |

## Concatenation Strategy

| Method | Behavior | Best For |
|---|---|---|
| `pl.concat([...], rechunk=True)` | Copies all data into single memory chunk | Further operations on the combined result |
| `df1.vstack(df2)` | Links memory locations, no copy | Quick append, minimal subsequent operations |
| `df1.extend(df2)` | Copies second DF into first (in-place) | Building up a DataFrame incrementally |

```python
# Use concat with rechunk for subsequent processing
combined = pl.concat([df1, df2, df3], rechunk=True)

# Use vstack for quick inspection
combined = df1.vstack(df2)
```
