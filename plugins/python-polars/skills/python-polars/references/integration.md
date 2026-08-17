# Integration Patterns

## Apache Arrow (Zero-Copy)

```python
import pyarrow as pa

# Polars -> Arrow (zero-copy)
arrow_table = df.to_arrow()

# Use newest compat level for modern Arrow types (e.g., string_view for true zero-copy)
arrow_table = df.to_arrow(compat_level=pl.CompatLevel.newest())

# Arrow -> Polars (zero-copy)
polars_df = pl.from_arrow(arrow_table)

# Arrow PyCapsule Interface (works without pyarrow dependency)
arrow_table = pa.table(df)  # Uses PyCapsule protocol
```

Keep data in Arrow format as long as possible. Convert only at the edges where a different layout is required.

## DuckDB

```python
import duckdb

# DuckDB can query Polars DataFrames directly by variable name
df = pl.DataFrame({"a": [1, 2, 3], "b": ["x", "y", "z"]})
result = duckdb.sql("SELECT a, b FROM df WHERE a > 1").pl()

# Returns a LazyFrame for deferred execution
lazy_result = duckdb.sql("SELECT * FROM df").pl(lazy=True)

# Query files directly
result = duckdb.sql("SELECT * FROM 'data.parquet' WHERE amount > 100").pl()
```

## Pandas Interop

```python
# Polars -> pandas
pandas_df = df.to_pandas()

# Zero-copy with PyArrow-backed extension arrays (preserves nulls, avoids NaN conversion)
pandas_df = df.to_pandas(use_pyarrow_extension_array=True)

# pandas -> Polars
polars_df = pl.from_pandas(pandas_df)
```

> **Warning**: `.to_pandas()` forces eager execution and copies data into pandas format, undermining Polars' performance advantages. Use only when passing data to a library that exclusively accepts pandas. Prefer `use_pyarrow_extension_array=True` to preserve null semantics and reduce copy overhead.

## Polars Expression Plugins (Rust)

For performance-critical custom operations, write Rust expression plugins that run at native speed:

```python
from polars.plugins import register_plugin_function


def my_custom_op(expr: pl.Expr) -> pl.Expr:
    return register_plugin_function(
        plugin_path="path/to/plugin",
        function_name="my_rust_function",
        args=[expr],
        is_elementwise=True,
    )


# Usage
df.with_columns(my_custom_op(pl.col("data")).alias("result"))
```

## Narwhals (DataFrame-Agnostic Libraries)

If you are writing a *library* rather than a pipeline, Narwhals lets you accept Polars, pandas, PyArrow, or DuckDB frames through a single Polars-like API without depending on any of them. Use it at library boundaries; use Polars directly inside your own pipelines.
