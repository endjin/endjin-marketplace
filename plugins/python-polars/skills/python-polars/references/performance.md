# Performance Optimization

## Automatic Query Optimizations (Lazy Mode)

Polars applies these optimization passes automatically in lazy mode. The names below are the `pl.QueryOptFlags` field names, so they map directly onto what you can inspect and disable.

| Pass | Description |
|---|---|
| `projection_pushdown` | Only read the columns actually used later in the query |
| `predicate_pushdown` | Apply predicates/filters as early as possible; for Parquet, uses row group min/max statistics to skip entire row groups. Also subsumes join collapsing |
| `cluster_with_columns` | Cluster sequential `with_columns` calls into independent calls, recovering parallelism lost to fragmented chains |
| `simplify_expression` | Run expression rewrite rules (constant folding, cheaper equivalents) until a fixed point |
| `slice_pushdown` | Push slices/limits (`.head()`, `.limit()`) down to the scan |
| `comm_subplan_elim` | Elide duplicate subplans and cache their outputs |
| `comm_subexpr_elim` | Elide duplicate expressions and cache their outputs |
| `check_order_observe` | Skip maintaining row order where the order would not be observed |
| `fast_projection` | Replace simple projections with an inlined projection that bypasses the expression engine |
| `sort_collapse` | Collapse sequential sort nodes into a single sort node |
| `pre_partition_hive` | Pre-partition hive-partitioned joins on their partition key (requires `predicate_pushdown`) |

Type coercion also happens automatically, but as part of plan resolution rather than as a toggleable optimization pass.

> **Deprecated**: the `collapse_joins` flag is deprecated; join collapsing is now handled by `predicate_pushdown`.

## Inspecting and Controlling Optimization

```python
# Compare the naive plan against the optimized plan
print(query.explain(optimized=False))
print(query.explain())

# Selectively disable a pass to isolate a suspected optimizer problem
result = query.collect(optimizations=pl.QueryOptFlags(predicate_pushdown=False))

# Disable everything (debugging only -- this is dramatically slower)
result = query.collect(optimizations=pl.QueryOptFlags.none())
```

In the optimized plan, look for the filter inside the scan node (predicate pushdown) and a line such as `PROJECT 2/47 COLUMNS` (projection pushdown). If a predicate did not push down, it almost always depends on a computed column or sits behind a Python UDF barrier — filter on source columns wherever you can.

## Group Operations for Parallelism

Combine multiple column operations into a single `with_columns()` call so Polars can parallelize them:

```python
# Good: All expressions execute in parallel
df = df.with_columns(
    normalized_amount=pl.col("amount") / pl.col("amount").max(),
    category_upper=pl.col("category").str.to_uppercase(),
    is_high_value=pl.col("amount") > 1000,
)

# Bad: Sequential calls prevent parallelization
df = df.with_columns(normalized_amount=pl.col("amount") / pl.col("amount").max())
df = df.with_columns(category_upper=pl.col("category").str.to_uppercase())
df = df.with_columns(is_high_value=pl.col("amount") > 1000)
```

## Use collect_all() for Related Queries

When running multiple queries from a shared base, use `pl.collect_all()` so Polars applies Common Subplan Elimination and runs shared computation only once:

```python
lf = pl.scan_parquet("data.parquet").filter(pl.col("year") == 2025)

query_a = lf.group_by("region").agg(pl.col("sales").sum())
query_b = lf.group_by("product").agg(pl.col("sales").mean())

# Both share the same scan+filter; Polars caches the shared subplan
result_a, result_b = pl.collect_all([query_a, query_b])

# Also supports engine parameter for streaming/GPU execution
result_a, result_b = pl.collect_all([query_a, query_b], engine="streaming")
```

## Prefer Native Expressions Over Python UDFs

The native expression engine runs in Rust; Python UDFs run in Python, cannot be parallelized, cannot be logically optimized, and force DataFrame materialization.

```python
# Good: Native expression (Rust, parallelizable)
df.with_columns(
    pl.col("text").str.to_uppercase().str.strip_chars()
)

# Bad: Python lambda (slow, single-threaded)
df.with_columns(
    pl.col("text").map_elements(lambda x: x.upper().strip())
)
```

If you must use Python, prefer `map_batches` (vectorized, single call) over `map_elements` (per-element, many calls):

```python
# Better: Batch-wise (one Python call for entire Series)
df.with_columns(
    pl.col("values").map_batches(lambda s: np.log(s.to_numpy()))
)

# Worse: Element-wise (one Python call per row)
df.with_columns(
    pl.col("values").map_elements(lambda x: np.log(x))
)

# Best: Native expression (no Python at all)
df.with_columns(pl.col("values").log())
```

For `map_batches`, set `is_elementwise=True` when the function is element-wise to enable streaming support. For performance-critical custom operations that cannot be expressed natively, consider writing a Rust expression plugin (see [Integration Patterns](integration.md#integration-patterns)) or using compiled functions (NumPy ufuncs, Numba `@guvectorize`).

## Memory Management

- **Downcast numeric types**: Use `Int32` instead of `Int64`, `Float32` instead of `Float64` where precision allows
- **Use `shrink_dtype()`**: Automatically shrink numeric columns to the minimal dtype that fits the data (e.g., `Int64` → `Int8` if values fit)
- **Use `shrink_to_fit()`**: Reclaim unused allocated memory after operations that reduce DataFrame size
- **Use Categorical/Enum**: For low-cardinality string columns
- **Use streaming**: For larger-than-memory datasets (see next section)
- **Use `Decimal` for financial data**: Avoid floating-point precision issues with `pl.Decimal(precision, scale)`

```python
# Downcast numeric types at read time using schema overrides
df = pl.read_parquet(
    "data.parquet",
    schema_overrides={
        "quantity": pl.Int32,
        "price": pl.Float32,
    },
)

# Or cast columns after loading
df = df.cast({"quantity": pl.Int32, "price": pl.Float32})

# shrink_dtype: automatically reduce numeric columns to smallest fitting dtype
# e.g., an Int64 column with values 0-100 becomes Int8
df = df.select(pl.all().shrink_dtype())

# shrink_to_fit: reclaim unused allocated memory after filtering or slicing
df = df.filter(pl.col("active") == True).shrink_to_fit()

# Use Categorical for low-cardinality string columns (e.g., country codes, status fields)
df = df.cast({"status": pl.Categorical, "country_code": pl.Categorical})

# Use Enum when the set of valid values is known upfront (provides type safety)
status_type = pl.Enum(["pending", "active", "closed"])
df = df.cast({"status": status_type})

# Use Decimal for financial data to avoid floating-point precision issues
df = df.cast({"amount": pl.Decimal(precision=12, scale=2)})

# Check memory usage of a DataFrame
estimated_size = df.estimated_size("mb")
print(f"DataFrame memory usage: {estimated_size:.1f} MB")
```

## GPU Acceleration

```python
# Up to 13x speedup on compute-bound queries (grouped aggregations, joins)
result = query.collect(engine="gpu")
# Transparent fallback: if GPU can't handle the query, falls back to CPU

# For more control, use the GPUEngine class
gpu_engine = pl.GPUEngine(
    device=0,           # GPU device index
    raise_on_fail=False,  # False = fall back to CPU; True = raise error
)
result = query.collect(engine=gpu_engine)
```

**Requirements**: NVIDIA Volta+ GPU (compute capability 7.0+), CUDA 12, Linux or WSL2 only (not native Windows). Install with `pip install polars[gpu] --extra-index-url=https://pypi.nvidia.com`.

**Best suited for**: grouped aggregations, joins, numeric/string/datetime operations. **Not supported**: Eager API, streaming engine, Date/Categorical/Enum types, user-defined functions.
