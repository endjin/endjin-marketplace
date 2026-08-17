# Large Dataset Handling

## Streaming Engine

The new streaming engine (v1.31+), based on morsel-driven parallelism, processes data in batches. It is 3-7x faster than the in-memory engine and enables larger-than-memory computation:

```python
# Enable streaming for larger-than-memory processing
result = (
    pl.scan_parquet("huge_dataset.parquet")
    .filter(pl.col("year") == 2025)
    .group_by("region")
    .agg(pl.col("revenue").sum())
    .collect(engine="streaming")
)

# Set streaming as the default engine globally
pl.Config.set_engine_affinity("streaming")
result = query.collect()  # Now uses streaming by default

# Sink directly to disk (sinks always use the streaming engine)
(
    pl.scan_csv("100gb_file.csv")
    .filter(pl.col("status") == "active")
    .select("id", "amount", "date")
    .sink_parquet("output.parquet")
)

# Process results in chunks via a generator (avoids full materialization)
for batch in query.collect_batches():
    process(batch)  # Each batch is a DataFrame
```

**Supported in streaming**: projections, filters, group-by, equi/cross/semi/anti joins, sorts, slicing, concatenation, cumulative ops, top_k/bottom_k, and most aggregations (sum, mean, min/max, first/last, std/var, count, n_unique).

**Not yet supported**: window functions (`.over()`), median/quantile aggregations, `.replace()`, inequality joins, fill/interpolation functions. Unsupported operations silently fall back to the in-memory engine for those specific parts of the query.

Available sinks: `sink_parquet()`, `sink_csv()`, `sink_ipc()`, `sink_ndjson()`.

## Partitioned Data

```python
# Read hive-style partitioned Parquet
df = pl.scan_parquet(
    "data/year=*/month=*/*.parquet",
    hive_partitioning=True,
)

# Write partitioned data via PyArrow
df.write_parquet(
    "output/",
    use_pyarrow=True,
    pyarrow_options={"partition_cols": ["year", "month"]},
)

# Partitioned sinks (streaming engine)
(
    pl.scan_parquet("data.parquet")
    .sink_parquet(
        pl.PartitionBy(
            "year", "month",
            max_rows_per_file=1_000_000,
        ),
        path="output/",
    )
)
```

## Reading Large Numbers of Files

When using glob patterns like `pl.scan_parquet("data/**/*.parquet")` with thousands or hundreds of thousands of files, several performance bottlenecks emerge. Understanding these is critical for building reliable data pipelines.

### What Happens During a Multi-File Scan

1. **Glob expansion**: Polars enumerates all matching file paths into memory. For cloud storage, this involves API calls per directory, which can trigger rate limiting.
2. **Metadata reading** (Parquet): Polars reads the footer/metadata from every matched file to determine schema, row group information, and column statistics. This scales linearly with file count.
3. **Schema inference** (CSV/NDJSON): Polars infers the schema by sampling rows from each file, adding per-file I/O overhead. Schema conflicts between files cause failures.
4. **Schema validation**: Polars checks that all files share a compatible schema.

### Performance Characteristics by Scale

| File Count | Local SSD | Network Storage (EFS/NFS/S3) | Key Bottleneck |
|------------|-----------|------------------------------|----------------|
| < 100 | Negligible overhead | Minor latency | None |
| 100 - 1,000 | Sub-second metadata scan | Seconds to tens of seconds | Metadata I/O |
| 1,000 - 10,000 | Seconds | Minutes | Metadata I/O, schema validation |
| 10,000 - 100,000 | Tens of seconds | Potentially unusable | Glob expansion, metadata I/O, OS limits |
| 100,000+ | Minutes | Impractical without workarounds | All of the above |

Real-world examples from Polars GitHub issues: 35,000 Parquet files on AWS EFS took over 30 seconds just for metadata collection. Scanning a dataset spread across daily Parquet files took ~4 minutes versus sub-second with DuckDB or PyArrow on the same data.

### Format Differences

| Aspect | Parquet | CSV | NDJSON |
|--------|---------|-----|--------|
| **Schema discovery** | Read from footer (fast, accurate) | Inferred by sampling (slow, error-prone) | Inferred by sampling (slow, error-prone) |
| **Predicate pushdown** | Row-group level via statistics | Not possible | Not possible |
| **Projection pushdown** | Column-level (reads only needed columns) | Must parse all columns | Must parse all fields |
| **Many-file overhead** | Moderate (footer read per file) | High (schema inference per file) | High (schema inference per file) |
| **Hive partitioning** | Fully supported with partition pruning | Not supported | Not supported |

**Key takeaway**: Parquet is significantly better for many-file workloads. If your source data is 100,000 JSON files, the single most impactful step is converting to Parquet first.

### OS-Level Limits

- **File descriptors**: Linux defaults to 1,024 open descriptors per process (`ulimit -n`). Windows defaults to 512 for the C runtime. While Polars reads files in bounded-parallel batches, very large file counts may still hit this limit.
- **Path length**: Windows has a 260-character path limit by default. Deep Hive partition paths can exceed this.
- **Directory entries**: Some filesystems become slow with hundreds of thousands of entries in a single directory. Hive-style partitioning naturally distributes files across subdirectories.
- **Inodes**: On ext4, millions of small files can exhaust the filesystem's fixed inode count before disk space runs out.

### Best Practices for Large File Counts

```python
import glob
import polars as pl

# BAD: Wide glob over 100,000 files -- slow metadata scanning
df = pl.scan_parquet("data/**/*.parquet").filter(
    pl.col("date") == "2025-01-15"
).collect()

# GOOD: Target partition paths directly (can be 600x faster)
df = pl.scan_parquet(
    "data/date=2025-01-15/*.parquet",
    hive_partitioning=True,
).collect()

# GOOD: Pre-filter file list in Python before handing to Polars
all_files = glob.glob("data/**/*.parquet", recursive=True)
relevant_files = [f for f in all_files if "2025-01" in f]
df = pl.scan_parquet(relevant_files).collect()

# GOOD: For CSV/NDJSON, always provide an explicit schema to skip inference
schema = {"id": pl.Int64, "name": pl.Utf8, "amount": pl.Float64}
df = pl.scan_csv(
    "data/**/*.csv",
    schema=schema,
    infer_schema_length=0,  # skip inference entirely
).collect()

# GOOD: Process files in batches to control memory and file descriptor usage
all_files = glob.glob("data/**/*.json", recursive=True)
batch_size = 1_000
results = []
for i in range(0, len(all_files), batch_size):
    batch = all_files[i : i + batch_size]
    result = pl.scan_ndjson(batch).select("id", "value").collect()
    results.append(result)
final = pl.concat(results)

# GOOD: Use collect_all for embarrassingly parallel independent queries
queries = [
    pl.scan_parquet(f).select("id", "amount").filter(pl.col("amount") > 100)
    for f in relevant_files
]
results = pl.collect_all(queries)
final = pl.concat(results)

# BEST: Compact many small files into fewer large Parquet files
# This eliminates per-file overhead for all subsequent reads
pl.scan_ndjson("data/raw/**/*.json").sink_parquet(
    "data/compacted/output.parquet"
)

# Or compact into partitioned Parquet for efficient filtered access
pl.scan_ndjson("data/raw/**/*.json").sink_parquet(
    pl.PartitionBy("year", "month", max_rows_per_file=1_000_000),
    path="data/compacted/",
)
```

```bash
# Increase file descriptor limit on Linux/macOS if hitting "Too many open files"
ulimit -n 65536
```

### Summary: Recommended Strategy for 100,000+ Files

1. **Convert to Parquet first** -- if source data is CSV/JSON, do a one-time compaction into partitioned Parquet files. This is the single biggest performance win.
2. **Use Hive partitioning** and target specific partition paths rather than scanning everything and filtering.
3. **Pre-filter file lists in Python** and pass explicit paths instead of wide glob patterns.
4. **Provide explicit schemas** for CSV/NDJSON to avoid per-file schema inference.
5. **Process in batches** if compaction is not feasible, using batch sizes of 500-2,000 files.
6. **Increase OS file descriptor limits** (`ulimit -n 65536`) for very large file counts.
7. **Keep Polars updated** -- multi-file scanning performance has improved significantly in recent versions (v1.27+).

## Efficient CSV to Parquet Conversion

```python
# Streaming conversion: never loads the entire CSV into memory
(
    pl.scan_csv("huge_file.csv")
    .sink_parquet("huge_file.parquet")
)
```

## Scaling Strategy

1. **Start with single-node Polars** -- handles the vast majority of analytical workloads
2. **Use streaming engine** for larger-than-RAM datasets (`engine="streaming"` or `sink_*` methods)
3. **Scale the single node up** before scaling out -- 64 vCores with proportional RAM covers an enormous range (this is also the ceiling on Microsoft Fabric Python notebooks)
4. **Use GPU acceleration** for compute-bound queries: `collect(engine="gpu")`
5. **Graduate to distributed solutions** only if you genuinely need horizontal scaling

Measure before assuming you need step 5. Teams routinely provision distributed compute for datasets that fit comfortably on one machine, and pay for the coordination overhead, the cluster startup latency, and the degraded developer experience without getting anything in return.
