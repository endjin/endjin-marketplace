# Parallel Execution

Behave has no built-in support for running tests in parallel. The runner iterates features sequentially. For parallel execution, use one of these approaches:

## BehaveX (Recommended)

[BehaveX](https://pypi.org/project/behavex/) is a wrapper around behave that adds parallel execution, HTML/JSON reporting, and auto-retry:

```bash
uv add behavex

behavex --parallel-processes=4 --parallel-scheme=scenario
```

| Flag | Description |
|---|---|
| `--parallel-processes=N` | Number of parallel processes |
| `--parallel-scheme=scenario` | Parallelize by scenario (or `feature`) |

Each parallel process runs its own independent behave instance with its own `environment.py` hooks. Context is not shared between processes.

## Subprocess-Based

Distribute feature files across separate `behave` subprocesses in CI pipelines:

```bash
# Run different feature directories in parallel
behave features/auth/ &
behave features/orders/ &
wait
```

## Alternative: pytest-bdd

If parallel execution is a hard requirement, consider `pytest-bdd` (v8.1+) which integrates with `pytest-xdist` for native parallelism. Trade-offs:

| | behave | pytest-bdd |
|---|---|---|
| **Runner** | Standalone `behave` command | pytest ecosystem |
| **Parallelism** | Via BehaveX or subprocesses | Native via `pytest-xdist` |
| **Gherkin support** | Full (including `Rule:`, data tables) | Subset (no data tables; `pytest-bdd-ng` adds them) |
| **State sharing** | Context object | pytest fixtures (dependency injection) |
| **IDE support** | PyCharm Professional only | Any IDE with pytest support |
| **Plugin ecosystem** | Limited | Full pytest plugin ecosystem |
