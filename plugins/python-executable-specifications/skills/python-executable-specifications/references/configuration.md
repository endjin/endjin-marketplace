# Configuration

## Configuration Files

Behave reads configuration from these files, searched in order:

1. `behave.ini`
2. `.behaverc`
3. `setup.cfg` (under `[behave]` section)
4. `tox.ini` (under `[behave]` section)
5. `pyproject.toml` (under `[tool.behave]` section)

## INI-Style Configuration

```ini
# behave.ini
[behave]
paths = features
format = pretty
color = true
junit = false
junit_directory = build/reports
logging_level = WARNING
show_skipped = false
show_snippets = true
stop = false
summary = true
default_tags = not (@skip or @not_implemented)
tag_expression_protocol = v2

[behave.userdata]
base_url = http://localhost:8000
browser = chrome
environment = test
```

## TOML Configuration

```toml
# pyproject.toml
[tool.behave]
paths = ["features"]
format = "pretty"
color = true
junit = false
junit_directory = "build/reports"
logging_level = "WARNING"
show_skipped = false
default_tags = "not (@skip or @not_implemented)"

[tool.behave.userdata]
base_url = "http://localhost:8000"
browser = "chrome"
environment = "test"
```

## Accessing Userdata in Code

```python
def before_all(context):
    userdata = context.config.userdata
    context.base_url = userdata.get("base_url", "http://localhost:8000")
    context.browser_name = userdata.get("browser", "chrome")
    context.environment = userdata.get("environment", "test")
```

Override userdata from the command line:

```bash
behave -D base_url=http://staging.example.com -D browser=firefox
```

## Key Command-Line Options

| Option | Description |
|---|---|
| `behave features/login.feature` | Run a specific feature file |
| `behave features/login.feature:12` | Run the scenario at line 12 |
| `-n "Login"` | Filter scenarios by name pattern |
| `--tags="@smoke"` | Filter by tag expression |
| `-f pretty` | Output format (`pretty`, `plain`, `json`, `progress`) |
| `-o results.json` | Write output to file |
| `--junit` | Generate JUnit XML reports |
| `--junit-directory DIR` | JUnit output directory |
| `-w` | WIP mode: only `@wip` scenarios, stop on first failure |
| `-d` | Dry run: parse without executing steps |
| `--stop` | Stop at first failure |
| `--no-capture` | Disable all capture (stdout, stderr, logging) |
| `--no-capture-stderr` | Disable stderr capture only |
| `--no-logcapture` | Disable logging capture only |
| `-D key=value` | Set userdata variable |
| `--steps-catalog` | Show a catalog of all available step definitions |
