# Testing Data Pipelines

Behave's table-driven scenarios are an unusually good fit for data-pipeline testing: a Gherkin table *is* a small DataFrame, so a scenario can state "given these input rows, the pipeline produces these output rows" in a form that a domain expert can read and the test runner can execute. The patterns in this section are library-agnostic — they work whether the pipeline is built on Polars, pandas, DuckDB, or PySpark. (For Polars-specific implementations of the table-conversion and comparison utilities, see the BDD section of the Polars data processing guidelines.)

## Choosing the Test Style

BDD is not the right tool for every layer of a data codebase. Choose per code type:

| Code type | Test approach | Location |
|---|---|---|
| Data pipelines, transformations, API ingestion | BDD/Gherkin (behave) | `tests/bdd/features/` + `tests/bdd/steps/` |
| Utility classes, pure functions, schema logic | pytest unit tests | `tests/unit/` |

The dividing line: if the behaviour is worth explaining to a stakeholder in terms of input rows and output rows, it belongs in a feature file. If it is an implementation detail (a parsing helper, a type coercion), a plain unit test is cheaper to write and maintain.

## Typed Data Tables

Gherkin tables carry only strings, but pipelines care about dtypes. Declare the type in the column heading with `name:type` syntax and have a shared utility parse the table into a typed DataFrame:

```gherkin
Given the following sales data exists in the silver layer
    | order_id:string | order_date:date | amount:float | is_priority:boolean |
    | O001            | 2025-01-15      | 100.00       | true                |
    | O002            | 2025-01-16      | 200.00       | false               |
```

Conventions that make this work in practice:

- Support a compact set of type names (`string`, `integer`, `float`, `boolean`, `date`, `datetime`/`timestamp`, `decimal`) plus a parameterised date format (`date(yyyy-MM-dd)`) for non-ISO test data.
- An **empty cell means null**; the literal `null` also means null. The literal `nan` means IEEE NaN for float columns — keeping null and NaN distinct in test data matters because they aggregate differently in most engines.
- Timestamps accept `2024-12-16T11:00:00Z`-style ISO strings and parse to UTC.
- The same utility handles headings *without* type annotations by falling back to schema inference, so quick scenarios stay lightweight.

This convention keeps the schema visible in the specification itself — a reviewer can see the dtypes under test without opening the step definitions.

## Structuring a Pipeline Scenario

Pipeline steps follow a strict triad, with the DataFrame passed between steps on `context`:

```python
from behave import given, when, then


@given("the following Physical Notification data")
def step_given_pn_data(context):
    context.input_df = table_to_dataframe(context.table)   # shared utility


@when("I calculate the settlement period average")
def step_when_calculate(context):
    context.result = calculate_sp_average(context.input_df)  # call the real SUT


@then("the settlement period average result should match")
def step_then_matches(context):
    expected = table_to_dataframe(context.table)
    assert_frames_equal_unordered(expected, context.result)  # shared utility
```

Rules of the triad: the Given only builds inputs, the When only invokes the system under test (never re-implements its logic), and the Then only compares. All intermediate state travels on `context`.

## A Shared Result-Assertion Step

Most Then steps in a pipeline suite are the same comparison. Define it once, in a `common_steps.py` importable by all features:

```python
@then("the result DataFrame should match")
def step_assert_dataframe_matches_table(context):
    assert context.error is None, f"Unexpected error: {context.error}"
    assert context.result is not None, "No result to compare"

    expected = table_to_dataframe(context.table)
    expected_cols = [h.split(":")[0] for h in context.table.headings]
    actual = select_columns(context.result, expected_cols)
    assert_frames_equal_unordered(expected, actual)
```

Design decisions worth copying:

- **Project to the expected columns.** The actual result may carry more columns than the scenario cares about; comparing only the columns named in the table keeps scenarios focused on the behaviour under test and stops every new output column from breaking every existing scenario.
- **Unordered comparison by default.** Sort both frames by all columns before comparing, so scenarios do not encode incidental row order. Keep a separate *ordered* comparison helper and reserve it for scenarios that specifically test sorting.
- **Fail on captured errors first.** The step asserts no upstream error was recorded before comparing, so a scenario that failed during When reports the real exception rather than a confusing "no result" mismatch.

## Capturing Errors for Later Assertion

When steps that call fallible code should catch and record, not raise — error behaviour is part of the specification:

```python
@when('I call get_pn_data with from "{from_time}" and to "{to_time}"')
def step_call_get_pn_data(context, from_time, to_time):
    try:
        context.result = wrangler.get_pn_data(from_time, to_time)
        context.error = None
    except Exception as e:
        context.result = None
        context.error = e
```

Happy-path scenarios then assert `context.error is None` (the shared assertion step above does this automatically); failure scenarios assert on the error's type and message:

```gherkin
Scenario: API failure raises a descriptive error
    Given the Elexon PN API returns status code 500
    When I call get_pn_data with from "2024-12-16T11:00" and to "2024-12-16T12:00"
    Then a RuntimeError is raised containing "Elexon API request failed"
```

## Mocking Upstream APIs with Fixture Files

Never call live APIs from tests. Record one real response per endpoint into `tests/bdd/fixtures/<source>/` (e.g. `pn_valid.json`), plus deliberately broken variants (`pn_missing_field.json`) for failure scenarios, and patch the HTTP layer to serve them:

```python
import json
from pathlib import Path
from unittest.mock import patch, Mock

FIXTURES_DIR = Path(__file__).parent.parent / "fixtures"


@given('the Elexon PN API returns the fixture "{fixture_path}"')
def step_mock_api_with_fixture(context, fixture_path):
    context.mock_response_json = json.loads((FIXTURES_DIR / fixture_path).read_text())
    context.mock_status_code = 200


@when("I call the wrangler")
def step_call_wrangler(context):
    mock_response = Mock()
    mock_response.status_code = context.mock_status_code
    mock_response.json.return_value = context.mock_response_json

    with patch("requests.get", return_value=mock_response):
        ...  # invoke the SUT, capturing context.result / context.error
```

The fixture file name appears verbatim in the Gherkin step, so the specification documents which recorded payload each scenario exercises. Keep fixtures small — trim recorded responses to the handful of records the scenario needs.

## Organising Features by Data Source

Group feature files by upstream source or pipeline stage in subfolders; step definition files stay flat (behave discovers only the top-level `steps/` directory):

```
tests/bdd/
├── features/
│   ├── elexon/
│   │   ├── get_pn_data.feature
│   │   └── deduplicate_fuelinst.feature
│   └── ceda/
│       └── wind_observations_wrangler.feature
├── fixtures/
│   ├── elexon/
│   │   ├── pn_valid.json
│   │   └── pn_missing_field.json
│   └── ceda/
│       └── sample_wind_obs.csv
└── steps/
    ├── common_steps.py
    ├── get_pn_data_steps.py
    └── wind_observations_wrangler_steps.py
```

Name each step module after its feature file (`get_pn_data.feature` → `get_pn_data_steps.py`) so the pairing is obvious despite the flat layout.

## Tag Taxonomy for Pipeline Suites

Two tags carry most of the weight in a data codebase:

- `@unit` — runs entirely in-memory and fast. This is the inner development loop: `behave --tags @unit` after every change.
- `@e2e` — touches files, databases, or other slow resources. Run before release or nightly.

These compose with the conventional tags (`@wip`, `@smoke`, `@skip`) described in [Tags and Filtering](tags-and-filtering.md#tags-and-filtering). A regression scenario that pins a fixed production bug deserves a comment naming the incident — the scenario is the executable record of the lesson.

## Tooling: Discovery Paths and the VS Code Extension

With features under `tests/bdd/features/` rather than the default root-level `features/`, point behave at the features directory **itself**, not its parent:

```ini
[behave]
paths = tests/bdd/features
```

Setting `paths = tests/bdd` also works for discovery but changes JUnit XML file naming (`TESTS-features.get_pn_data.xml` instead of `TESTS-get_pn_data.xml`), which breaks the Behave VSC extension's test explorer.

For VS Code, install the **Behave VSC** extension (`jimasp.behave-vsc`) and mirror the path in `.vscode/settings.json`:

```json
{
    "behave-vsc.featuresPath": "tests/bdd/features"
}
```

Gotchas learned in production:

- `behave-vsc.featuresPath` must match `paths` in `behave.ini` exactly.
- Do **not** configure `junit` output in `behave.ini` — the extension passes its own `--junit` and `--junit-directory` flags and the two conflict.
- Avoid trailing colons in step text (`Then the result should match` not `Then the result should match:`) — the extension's step matcher can fail to link steps ending with a colon, even though behave itself accepts them.
