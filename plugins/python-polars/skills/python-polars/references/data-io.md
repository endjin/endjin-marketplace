# Data I/O

## Parquet (Preferred Format)

Parquet is the recommended file format for Polars. It supports columnar storage, compression, and row group metadata that enables predicate and projection pushdown.

```python
# Reading with automatic optimizations
result = (
    pl.scan_parquet("data.parquet")
    .filter(pl.col("date") > "2025-01-01")
    .select("customer_id", "amount", "date")
    .collect()
)

# Writing with compression
df.write_parquet("output.parquet", compression="zstd")

# Larger-than-memory: sink directly to disk
(
    pl.scan_csv("huge_file.csv")
    .filter(pl.col("status") == "active")
    .sink_parquet("output.parquet")
)
```

**Parallel reading strategies** for `scan_parquet()`:

| Strategy | Behavior | Best For |
|---|---|---|
| `"auto"` | Polars selects automatically (default) | General use |
| `"columns"` | Parallelize by columns | Wide tables |
| `"row_groups"` | Parallelize by row groups | Tall tables |
| `"prefiltered"` | Evaluate predicates first, then parallelize over both columns and row groups | Large filtered datasets with selective predicates |
| `"none"` | No parallelization | Debugging, minimal resource usage |

> **Tip**: Sort data before writing Parquet to cluster related values in row groups, making predicate pushdown significantly more effective.

## CSV

Handle dirt at the scan, not downstream. Every messy-data option you set here keeps the rest of the query strict and simple.

```python
# Lazy scan with schema overrides
df = (
    pl.scan_csv(
        "data.csv",
        null_values=["N/A", "NA", "NULL", ""],  # become real nulls, not strings
        try_parse_dates=True,                    # ISO-like strings -> temporal dtypes
        schema_overrides={"amount": pl.Float64, "date": pl.Date},
        infer_schema_length=10000,
    )
    .collect()
)

# Handle messy CSVs
df = pl.read_csv(
    "messy.csv",
    truncate_ragged_lines=True,
    ignore_errors=True,
    null_values=["NA", "N/A", ""],
)
```

## Cloud Storage

Polars supports S3 (`s3://`), Azure Blob Storage (`az://`, `abfss://`), and Google Cloud Storage (`gs://`) paths.

```python
# S3 with lazy scan (benefits from pushdowns)
df = pl.scan_parquet("s3://bucket/path/data.parquet").collect()

# Control file caching for cloud CSVs
df = pl.scan_csv("s3://bucket/data.csv", file_cache_ttl=3600).collect()

# Credential providers (preferred over inline credentials)
df = pl.scan_parquet(
    "s3://bucket/data.parquet",
    credential_provider=pl.CredentialProviderAWS(),
).collect()

# Or pass credentials via storage_options
df = pl.scan_parquet(
    "s3://bucket/data.parquet",
    storage_options={
        "aws_access_key_id": "...",
        "aws_secret_access_key": "...",
        "aws_region": "us-east-1",
    },
).collect()

# Azure Blob Storage using az:// scheme
df = pl.scan_parquet("az://container/path/data.parquet").collect()

# Azure Blob Storage with storage account key
df = pl.scan_parquet(
    "az://container/path/data.parquet",
    storage_options={
        "account_name": "mystorageaccount",
        "account_key": "...",
    },
).collect()

# Azure Data Lake Storage Gen2 using abfss:// scheme
df = pl.scan_parquet(
    "abfss://filesystem@storageaccount.dfs.core.windows.net/path/data.parquet"
).collect()

# Azure Data Lake Storage Gen2 with service principal authentication
df = pl.scan_parquet(
    "abfss://filesystem@storageaccount.dfs.core.windows.net/path/data.parquet",
    storage_options={
        "account_name": "mystorageaccount",
        "client_id": "...",
        "client_secret": "...",
        "tenant_id": "...",
    },
).collect()

# Azure with DefaultAzureCredential (recommended for production)
# Uses managed identity, Azure CLI, or environment credentials automatically
df = pl.scan_parquet(
    "az://container/path/data.parquet",
    storage_options={
        "account_name": "mystorageaccount",
        "use_azure_cli": "true",
    },
).collect()
```

## Database

```python
# Read from database via connection string
df = pl.read_database_uri(
    "SELECT * FROM orders WHERE year = 2025",
    "postgresql://user:pass@host/db",
)

# Read from database via connection object
df = pl.read_database("SELECT * FROM users WHERE active = 1", connection)
```

## Delta Lake

```python
# Lazy scan with time travel support
df = pl.scan_delta("path/to/delta_table").collect()
df = pl.scan_delta("path/to/delta_table", version=5).collect()

# Writing via the deltalake library
from deltalake import write_deltalake
write_deltalake("path/to/delta_table", df.to_arrow())
```

## Apache Iceberg

```python
from pyiceberg.catalog import load_catalog

catalog = load_catalog("default")
table = catalog.load_table("db.my_table")

# Lazy scan (benefits from pushdowns)
lf = pl.scan_iceberg(table)
result = lf.filter(pl.col("year") == 2025).collect()
```
