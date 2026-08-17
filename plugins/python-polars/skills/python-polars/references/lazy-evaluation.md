# Lazy vs Eager Evaluation

## Prefer Lazy Mode

Lazy evaluation should be the default for production code. The query is not executed until `.collect()` is called, allowing Polars to apply automatic optimizations.

```python
# Preferred: Lazy mode with automatic optimizations
result = (
    pl.scan_parquet("data.parquet")
    .filter(pl.col("amount") > 100)
    .group_by("category")
    .agg(pl.col("amount").sum())
    .collect()
)

# Avoid for large data: Eager mode loads everything immediately
df = pl.read_parquet("data.parquet")
```

## Scan vs Read

| Function | Mode | Use When |
|---|---|---|
| `pl.scan_parquet()` | Lazy | Large files, production code, default choice |
| `pl.read_parquet()` | Eager | Small files, interactive exploration |
| `pl.scan_csv()` | Lazy | Large CSVs, need filtering/projection pushdown |
| `pl.read_csv()` | Eager | Small CSVs, quick inspection |
| `pl.scan_ndjson()` | Lazy | Large newline-delimited JSON |
| `pl.scan_delta()` | Lazy | Delta Lake tables |
| `pl.scan_iceberg()` | Lazy | Apache Iceberg tables (via PyIceberg) |

**Rule**: Always use `scan_*` for production code. Reserve `read_*` for interactive exploration and small datasets.

## Converting Eager to Lazy

```python
# Convert an existing DataFrame to lazy for optimization
lazy_result = df.lazy().filter(pl.col("x") > 5).select("a", "b").collect()
```

## Inspecting the Query Plan

```python
query = (
    pl.scan_parquet("data.parquet")
    .filter(pl.col("amount") > 100)
    .select("customer_id", "amount")
)

# View the optimized query plan
print(query.explain())

# Visualize the execution graph (supports engine parameter for streaming plans)
query.show_graph()
query.show_graph(plan_stage="physical", engine="streaming")

# Check the output schema without executing
print(query.collect_schema())

# Inspect combined query plans for multiple LazyFrames
print(pl.explain_all([query_a, query_b]))
```
