# Reporting

## Built-in Formatters

| Formatter | Command | Description |
|---|---|---|
| `pretty` | `-f pretty` | Colorized output with step details (default) |
| `plain` | `-f plain` | Minimal output for CI environments |
| `json` | `-f json -o results.json` | Machine-readable JSON output |
| `json.pretty` | `-f json.pretty` | Human-readable JSON output |
| `progress` | `-f progress` | Dot notation per scenario (`.` pass, `F` fail, `S` skip) |
| `progress2` | `-f progress2` | Step-level progress dots |
| `progress3` | `-f progress3` | Scenario and step progress with details |
| `rerun` | `-f rerun -o rerun.txt` | Records failed scenario locations for re-running |
| `null` | `-f null` | Suppresses all output (useful in scripts) |
| `steps` | `-f steps` | List all available step definitions |
| `steps.catalog` | `-f steps.catalog` | Catalog of step definitions with file locations |
| `steps.usage` | `-f steps.usage` | Step definitions with usage statistics |
| `tags` | `-f tags` | List all tags used in feature files |
| `tags.location` | `-f tags.location` | Tags with their file locations |

## JUnit XML Reports

Generate JUnit XML reports for CI/CD integration:

```bash
behave --junit --junit-directory build/reports
```

## Multiple Formatters

Use multiple formatters simultaneously -- one writes to stdout, others write to files:

```bash
behave -f pretty -f json -o results.json --junit --junit-directory build/reports
```

## HTML Reports

The `behave-html-pretty-formatter` package (actively maintained) generates rich HTML reports with dark mode support, embedded screenshots, and collapsible sections:

```bash
uv add behave-html-pretty-formatter

behave -f html-pretty -o behave-report.html
```

Register the formatter in `behave.ini`:

```ini
[behave.formatters]
html-pretty = behave_html_pretty_formatter:PrettyHTMLFormatter
```

## Allure Reports

For rich, interactive HTML reports integrated with your CI/CD dashboard:

```bash
uv add allure-behave

behave -f allure_behave.formatter:AllureFormatter -o allure-results ./features
allure serve allure-results
```

Register the formatter in `behave.ini`:

```ini
[behave.formatters]
allure = allure_behave.formatter:AllureFormatter
```

## Custom Formatter Registration

Register any third-party or custom formatter via `behave.ini` under `[behave.formatters]`. The format is `alias = module.path:ClassName`. Formatter-specific settings use the `behave.formatter.<ALIAS>.<SETTING>` userdata convention:

```ini
[behave.formatters]
teamcity = behave_teamcity:TeamcityFormatter

[behave.userdata]
behave.formatter.html-pretty.title_string = My Test Suite
```

## Re-running Failed Tests

Use the `rerun` formatter to capture failures, then re-run only those:

```bash
# First run: capture failures
behave -f rerun -o rerun.txt -f pretty

# Re-run only failed scenarios
behave @rerun.txt
```
