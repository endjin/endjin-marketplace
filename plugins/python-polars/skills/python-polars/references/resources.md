# Resources and References

## Official Polars

- [Polars Official User Guide](https://docs.pola.rs/)
- [Polars Python API Reference](https://docs.pola.rs/api/python/stable/reference/)
- [Coming from Pandas - Migration Guide](https://docs.pola.rs/user-guide/migration/pandas/)
- [Version 1 Upgrade Guide](https://docs.pola.rs/releases/upgrade/1/)
- [Lazy API and Query Optimization](https://docs.pola.rs/user-guide/concepts/lazy-api/)
- [Streaming Engine](https://docs.pola.rs/user-guide/concepts/streaming/)
- [Sources and Sinks](https://docs.pola.rs/user-guide/lazy/sources_sinks/)
- [Expression Plugins](https://docs.pola.rs/user-guide/plugins/expr_plugins/)
- [GPU Support](https://docs.pola.rs/user-guide/gpu-support/)
- [Cloud Storage](https://docs.pola.rs/user-guide/io/cloud-storage/)
- [Polars Testing Module](https://docs.pola.rs/py-polars/html/reference/testing.html)
- [Polars Benchmarks (PDS-H)](https://pola.rs/posts/benchmarks/)

## LLM and Agent Tooling

- [Polars with LLMs](https://docs.pola.rs/user-guide/misc/polars_llms/) — official guidance on generating Polars code with language models
- [Official Polars Agent Skills](https://github.com/polars-inc/skills) — the `polars` skill and its reference files
- [Polars MCP Server](https://mcp.pola.rs/mcp) — hosted documentation lookup for agents

## Ecosystem

- [Pandera Polars Validation](https://pandera.readthedocs.io/en/latest/polars.html)
- [DuckDB-Polars Integration](https://duckdb.org/docs/stable/guides/python/polars)
- [Delta Lake with Polars](https://delta-io.github.io/delta-rs/integrations/delta-lake-polars/)
- [Apache Iceberg with Polars](https://docs.pola.rs/py-polars/html/reference/api/polars.scan_iceberg.html)
- [Narwhals](https://narwhals-dev.github.io/narwhals/) — DataFrame-agnostic API for library authors
- [Chrono Format Specifiers](https://docs.rs/chrono/latest/chrono/format/strftime/index.html)

## Adventures in Polars (endjin blog series)

- [Polars: Faster Pipelines, Simpler Infrastructure, Happier Engineers](https://endjin.com/blog/polars-faster-pipelines-simpler-infrastructure-happier-engineers) — the case for Polars, migration risk, and where it does and does not fit
- [Under the Hood: What Makes Polars So Scalable and Fast](https://endjin.com/blog/under-the-hood-what-makes-polars-so-scalable-and-fast) — Rust foundation, Arrow layout, query optimizer, SIMD and vectorization
- [Practical Polars: Code Examples for Everyday Data Tasks](https://endjin.com/blog/practical-polars-code-examples-everyday-data-tasks) — worked examples across loading, exploration, filtering, calculated columns, nested types, pivoting, lazy evaluation, and streaming
- [Polars Workloads on Microsoft Fabric](https://endjin.com/blog/polars-workloads-on-microsoft-fabric) — OneLake access, ABFSS paths, notebook configuration, and Fabric-specific gotchas
- [endjin-polars-examples](https://github.com/endjin/endjin-polars-examples) — supporting repository: runnable notebooks over World Bank Open Data in CSV, JSON, Parquet, and DuckDB form, with `uv` for dependency management
