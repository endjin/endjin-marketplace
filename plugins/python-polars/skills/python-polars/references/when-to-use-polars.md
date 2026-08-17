# When to Use Polars

Polars is a high-performance DataFrame library written in Rust with first-class Python bindings. It uses Apache Arrow columnar memory format, enabling parallel execution, SIMD optimizations, and zero-copy interoperability with the broader Arrow ecosystem. Polars delivers 3-10x faster performance than pandas on typical analytical workloads (10-100x at larger scales where pandas runs out of memory), while requiring only 2-4x the dataset size in RAM (compared to pandas' 5-10x the dataset size).

## Why Polars

- **Performance**: Rust-based engine with automatic multi-threaded execution; no GIL (Global Interpreter Lock) contention, meaning Polars bypasses Python's single-threaded execution constraint by performing computations entirely in Rust, allowing true parallel execution across multiple CPU cores
- **Lazy Evaluation**: Query optimizer applies predicate pushdown, projection pushdown, and common subplan elimination automatically
- **Streaming Engine**: New morsel-driven streaming engine (v1.31+) processes data in batches, achieving 3-7x faster execution than the in-memory engine; enables larger-than-memory processing via `sink_*` methods
- **Memory Efficiency**: Apache Arrow columnar format with zero-copy operations and validity bitmaps for null handling
- **Type Safety**: Strict type system prevents silent data corruption common in pandas
- **No Index**: Rows accessed by integer position only, making queries predictable and composable
- **Developer Experience**: Small, orthogonal API surface that composes; runs locally in a normal IDE with a normal debugger. As the community puts it: *"come for the speed, stay for the API."*

## Evidence from Production Migrations

| Measure | Observed |
|---|---|
| Test suite runtime (Spark → Polars) | ~60 minutes → ~30 seconds |
| Monthly compute cost | Reduced by more than 50% |
| Throughput vs pandas | 5-20x typical; up to 100x in some scenarios |
| Energy consumption vs pandas | ~8x lower on large-DataFrame tasks (EASE 2024 study); ~40% more efficient on TPC-H |
| Workloads reflexively assigned to Spark that fit single-node Polars | 90%+ |

The underlying shift is that commodity hardware has overtaken the requirements of most analytical workloads. A machine with 64 cores and 512 GB of RAM handles the vast majority of pipelines that were architected for a distributed cluster a decade ago, without any of the cluster's coordination overhead, startup latency, or operational burden.

## When Polars Is (and Isn't) the Right Choice

**Strong fit:**

- Hitting pandas' memory or performance ceiling
- Suspecting Spark is overkill for the data volume actually being processed
- Valuing developer experience, local testability, and fast feedback loops
- Reducing cloud compute cost
- Greenfield pipelines with no existing distributed dependency

**Weak fit:**

- Existing pipelines that are already fast enough and stable (migration has a cost; performance you do not need is not a benefit)
- Codebases with insufficient test coverage to validate a migration safely
- Deep dependencies on Spark-specific features (Structured Streaming, MLlib, Delta features that require Spark such as V-ORDER or Liquid Clustering)
- Workloads that genuinely exceed single-node capacity and need horizontal scale

> **Migration note**: Migration risk is lower than most teams expect *provided there is adequate test coverage*. Polars' stricter type system frequently surfaces bugs that were silently present in pandas code. Migrate incrementally, run both implementations in parallel, and compare outputs before cutover.

## Prerequisites

- **Python 3.10+** (Python 3.9 support was dropped)
- **polars** package (`pip install polars` or `pip install polars[all]` for full I/O support)
- Optional: **polars[gpu]** for GPU acceleration (requires NVIDIA Volta+ GPU, CUDA 12, Linux/WSL2 only; install with `pip install polars[gpu] --extra-index-url=https://pypi.nvidia.com`)
- Optional: **pandera** for schema validation, **hypothesis** for property-based testing
