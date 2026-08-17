# Working with LLMs and Coding Agents

Polars publishes explicit guidance on getting good Polars code out of language models. The core problem is that pandas dominates the training data, and pre-1.0 Polars idioms are still widespread on the public web, so an unprimed model will reach for `groupby`, `apply`, and eager `read_csv` by default.

## Install the Official Polars Skill

Polars maintains an official agent skill that loads Polars expertise into the agent, covering idiomatic lazy-API usage, expression contexts, window functions, the streaming engine, and pandas translation.

```
/plugin marketplace add polars-inc/skills
/plugin install polars@polars
```

Or clone and copy the `polars/` directory into `~/.claude/skills/` (personal) or `.claude/skills/` (project scope).

## Run the Polars MCP Server

The MCP server gives the model live access to the official Polars and Polars Cloud documentation, so it can verify an API against the real reference rather than recalling it.

```json
{
  "mcpServers": {
    "ask_polars": {
      "command": "npx",
      "args": ["mcp-remote", "https://mcp.pola.rs/mcp"]
    }
  }
}
```

A complementary local server, `polars-mcp`, resolves lookups against the Polars version actually installed in your project environment — which matters more than the latest docs when your runtime lags (as it typically does on Fabric).

## Prompt-Level Measures

- **Set a default in the system prompt**: "Use Polars as the default DataFrame library." Without this, models fall back to pandas.
- **Enable web search** so the model can check the current API rather than reconstructing it from training data.
- **Provide a concrete example** of the syntax you want (`df.group_by("a").agg(pl.col("b").mean())`). Examples measurably raise the rate of valid output.
- **Combine web search with examples** — the combination is more effective than either alone.
- **Give explicit corrections** for known failure modes: "use `group_by`, not `groupby`"; "use the lazy API and `.collect()` once".

## Review Checklist for Generated Polars Code

Machine-generated Polars fails in predictable ways. Check for:

1. `read_*` where `scan_*` belongs
2. More than one `.collect()` in a single pipeline
3. `map_elements` / `apply` standing in for a native expression
4. A loop of `with_columns()` calls instead of one batched call
5. Bare string literals in `then()`/`otherwise()`
6. Filters placed after `group_by()` or `join()` rather than before
7. Pre-1.0 method names (see [API Currency](debugging.md#api-currency))
8. Missing `.alias()` on derived columns
