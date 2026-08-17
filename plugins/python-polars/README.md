# Python Polars

Endjin's Polars data-processing guidelines, packaged as an agent skill, plus the official Polars documentation MCP server.

## What you get

**Skill: `python-polars`** — fires when you write, review, debug, or optimise Python code that uses Polars, and when you convert pandas or PySpark code to it. `SKILL.md` carries the rules that matter on every query (lazy by default, expressions over UDFs, filter early, batch `with_columns`, collect once) and routes to seventeen reference files that are read only when the task needs them:

| Reference | Covers |
|---|---|
| `lazy-evaluation.md` | `scan_*` vs `read_*`, query plans |
| `expressions.md` | Window functions, selectors, string/temporal/struct operations |
| `pipe-composition.md` | `.pipe()` stage contracts and their optimizer cost |
| `data-io.md` | Parquet, CSV, databases, Delta, Iceberg, S3/Azure/ADLS |
| `schemas-and-types.md` | Casting, dtype choice, null handling, Categorical vs Enum |
| `performance.md` | Parallelism, `collect_all()`, memory, GPU |
| `large-datasets.md` | Streaming engine, `sink_*`, partitioning, small-file problems |
| `pipeline-patterns.md` | Codebase layout, helpers, configuration, validation boundaries |
| `testing.md` | `assert_frame_equal`, fixtures, property-based tests, Pandera |
| `bdd-testing.md` | Gherkin/behave executable specifications over Polars pipelines |
| `integration.md` | Arrow, DuckDB, pandas interop, Rust expression plugins |
| `microsoft-fabric.md` | Fabric notebooks, OneLake, ABFSS paths |
| `anti-patterns.md` | Fifteen ways Polars code goes wrong, with fixes |
| `debugging.md` | Errors, silent wrong results, CSV parsing, pre-1.0 API names |
| `llm-codegen.md` | Getting good Polars out of other models and agents |
| `resources.md` | Official docs, ecosystem, endjin's *Adventures in Polars* series |

**MCP server: `ask_polars`** — hosted by the Polars team at `https://mcp.pola.rs/mcp`, giving the agent live lookup against the official Polars and Polars Cloud documentation. This matters because Polars changed substantially at 1.0 and pre-1.0 idioms are still widespread in training data, so an unprimed model reaches for `groupby`, `apply`, and eager `read_csv` by default. Requires Node.js (`npx`) on the machine running the agent; the first run may prompt in a browser to complete the remote connection.

## Install

```shell
/plugin marketplace add endjin/endjin-marketplace
/plugin install python-polars@endjin
/reload-plugins
```

The skill triggers automatically from its description. To invoke it explicitly: `/python-polars:python-polars`.

## Source

The reference files are generated from `knowledge-base/python-polars-data-processing-guidelines.md` in [endjin/python-llm-knowledge-base](https://github.com/endjin/python-llm-knowledge-base). Fix substantive content there and re-split, rather than editing the references in place.

## Portability

The skill follows the [Agent Skills standard](https://github.blog/changelog/2025-12-18-github-copilot-now-supports-agent-skills/) and works unchanged in Claude Code, GitHub Copilot CLI, VS Code, Cursor, and Codex CLI. MCP server bundling via `.mcp.json` is supported by Claude Code; other tools may need the `ask_polars` server registered by hand.
