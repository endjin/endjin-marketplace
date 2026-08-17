# Microsoft Fabric

Fabric's Python notebooks ship with Polars pre-installed and provide native OneLake access on single-node compute. For workloads that fit in memory this is usually a better fit than Spark: notebooks start in seconds rather than minutes, consume far fewer capacity units, and the code is testable locally. Published benchmarks put Polars and DuckDB at roughly **4-5x cheaper and faster than Spark** for common Fabric workloads.

## Environment Detection

The critical pattern for local-to-cloud development is detecting where the code is running, because `notebookutils` exists only inside Fabric:

```python
import os


def is_fabric_python_notebook() -> bool:
    """True when running in a Fabric Python (non-Spark) notebook."""
    return "JUPYTER_SERVER_HOME" in os.environ and "SPARK_HOME" not in os.environ
```

## Path Construction

Abstract the environment difference behind a small path helper so pipeline code never branches on it. Locally the paths are ordinary filesystem routes; in Fabric they are ABFSS URLs.

```python
from pathlib import Path


class FabricPaths:
    """Resolves Lakehouse paths for both local and Fabric execution."""

    def __init__(self, workspace: str, lakehouse: str, local_root: Path) -> None:
        # ABFSS requires URL-encoded spaces
        self._workspace = workspace.replace(" ", "%20")
        self._lakehouse = lakehouse.replace(" ", "%20")
        self._local_root = local_root
        self._is_fabric = is_fabric_python_notebook()

    def _abfss(self, area: str, relative: str) -> str:
        return (
            f"abfss://{self._workspace}@onelake.dfs.fabric.microsoft.com/"
            f"{self._lakehouse}.Lakehouse/{area}/{relative}"
        )

    def files(self, relative: str) -> str:
        if self._is_fabric:
            return self._abfss("Files", relative)
        return str(self._local_root / "Files" / relative)

    def tables(self, relative: str) -> str:
        if self._is_fabric:
            return self._abfss("Tables", relative)
        return str(self._local_root / "Tables" / relative)
```

Lakehouse path formats:

| Area | ABFSS path |
|---|---|
| Files | `abfss://{workspace}@onelake.dfs.fabric.microsoft.com/{lakehouse}.Lakehouse/Files/{path}` |
| Tables | `abfss://{workspace}@onelake.dfs.fabric.microsoft.com/{lakehouse}.Lakehouse/Tables/{schema}/{table}` |

A pinned lakehouse can be reached via the `/lakehouse/default/` shorthand, but **prefer full ABFSS paths in production code**: they are explicit, they survive the notebook being re-pinned, and they work for cross-lakehouse access.

## Authentication

Reads from the *pinned* lakehouse need no credentials. Any cross-lakehouse or cross-workspace access requires a bearer token:

```python
import notebookutils  # Fabric only

storage_options = {
    "bearer_token": notebookutils.credentials.getToken("storage"),
    "use_fabric_endpoint": "true",
}

lf = pl.scan_parquet(paths.files("raw/orders/*.parquet"), storage_options=storage_options)
```

## Delta Tables

```python
# Read
lf = pl.scan_delta(paths.tables("dbo/orders"), storage_options=storage_options)

# Write
df.write_delta(paths.tables("dbo/orders"), mode="overwrite",
               storage_options=storage_options)
df.write_delta(paths.tables("dbo/orders"), mode="append",
               storage_options=storage_options)

# Upsert
(
    df.write_delta(
        paths.tables("dbo/orders"),
        mode="merge",
        storage_options=storage_options,
        delta_merge_options={
            "predicate": "target.order_id = source.order_id",
            "source_alias": "source",
            "target_alias": "target",
        },
    )
    .when_matched_update_all()
    .when_not_matched_insert_all()
    .execute()
)
```

`LazyFrame.sink_delta()` is now available and supports the same modes without materializing the frame, but it is marked **unstable** in the Polars API. Check behaviour against your installed version before relying on it in production:

```python
lf.sink_delta(paths.tables("dbo/orders"), mode="append", storage_options=storage_options)
```

## Notebook Compute Configuration

Scale the single node with the `%%configure` magic. Available sizes are 4, 8, 16, 32, and 64 vCores, with memory scaling proportionally:

```
%%configure
{"executor_cores": 64}
```

## Fabric-Specific Gotchas

| Gotcha | Detail | Mitigation |
|---|---|---|
| **Timezone-naive timestamps** | The Fabric SQL endpoint requires timezone-aware timestamps. Writing naive datetimes causes SQL endpoint errors. | `df.with_columns(pl.col("event_time").dt.replace_time_zone("UTC"))` before writing |
| **V-ORDER not applied** | V-ORDER is a Fabric-specific Delta optimization that requires Spark. Tables written by Polars do not get it. | Tune row groups instead; measure whether it matters for your read pattern |
| **Liquid Clustering unavailable** | Also Spark-only. | Use Hive-style partitioning or sorted writes |
| **DirectLake read performance** | Power BI DirectLake prefers large row groups. | Configure larger row groups (8M+ rows) when writing tables destined for DirectLake |
| **64 vCore ceiling** | Single-node compute caps out here. | Beyond this, Spark becomes necessary — but confirm the data genuinely exceeds the ceiling first |
| **Version lag** | The pre-installed Polars is often behind the latest release. | `%pip install polars --upgrade` at the top of the notebook, accepting slower startup; or pin a version in a custom environment |

```python
# Verify the runtime version before relying on newer APIs
import polars as pl
print(pl.__version__)
```

## Recommended Practice

1. Write pipeline logic as `.pipe()` stages in a `src/` package, not in notebook cells.
2. Test those stages locally with pytest against small fixtures; no Fabric dependency.
3. Keep the notebook thin: resolve paths, call the pipeline, write the output.
4. Use `scan_*` and `sink_*` so the memory ceiling of the node is a soft limit rather than a hard failure.
5. Add timezone information to every timestamp column before writing to a Delta table.
