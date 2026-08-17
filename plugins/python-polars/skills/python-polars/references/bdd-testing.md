# BDD Testing with Gherkin and behave

Gherkin tables map naturally onto Polars DataFrames: each scenario states "given these input rows, the pipeline produces these output rows", and the step definitions convert both tables to frames and compare. This section covers the Polars-specific machinery; the library-agnostic patterns (project layout, shared assertion steps, error capture, API fixture mocking, tooling configuration) live in the behave BDD testing guidelines.

## Converting Behave Tables to DataFrames

Table headings declare dtypes with `name:type` syntax (`| order_id:string | amount:float |`). A shared utility parses the table into a typed frame; headings without annotations fall back to schema inference.

```python
from typing import Any

import polars as pl


def behave_table_to_polars_dataframe(table: Any) -> pl.DataFrame:
    """Convert a Behave table to a Polars DataFrame, using an explicit
    schema when headings carry name:type annotations."""
    if ":" in table.headings[0]:
        return _with_explicit_schema(table)
    return _with_inferred_schema(table)


def _with_explicit_schema(table: Any) -> pl.DataFrame:
    cols = [h.split(":") for h in table.headings]
    if any(len(c) != 2 for c in cols):
        raise ValueError("field_name:field_type expected in table headings")

    schema = {name: _string_to_polars_type(t) for name, t in cols}
    # Empty cells and the literal "null" become None before any casting
    rows = [
        {name: (None if cell in ("", "null") else cell)
         for (name, _), cell in zip(cols, row.cells)}
        for row in table
    ]
    if not rows:
        return pl.DataFrame(schema=schema)

    df = pl.DataFrame(rows)
    for name, field_type in cols:
        ft = field_type.lower()
        if ft == "date":
            df = df.with_columns(pl.col(name).str.to_date())
        elif ft.startswith("date("):
            # date(yyyy-MM-dd) -> chrono format specifiers
            fmt = (ft.split("(")[1].strip(")")
                   .replace("yyyy", "%Y").replace("MM", "%m").replace("dd", "%d"))
            df = df.with_columns(pl.col(name).str.to_date(format=fmt))
        elif ft in ("datetime", "timestamp"):
            df = df.with_columns(
                pl.col(name).str.replace(" ", "T", literal=True).str.strptime(
                    pl.Datetime(time_zone="UTC"),
                    format="%Y-%m-%dT%H:%M:%S%.f", strict=False,
                )
            )
        elif schema[name] == pl.Boolean:
            df = df.with_columns(
                pl.when(pl.col(name).str.to_lowercase() == "true").then(True)
                .when(pl.col(name).str.to_lowercase() == "false").then(False)
                .otherwise(None).alias(name).cast(pl.Boolean)
            )
        elif schema[name] == pl.Decimal:
            df = df.with_columns(pl.col(name).cast(pl.Decimal(scale=2)))
        elif schema[name] is not None and schema[name] != pl.Object:
            df = df.with_columns(pl.col(name).cast(schema[name]))
    return df


def _with_inferred_schema(table: Any) -> pl.DataFrame:
    rows = [
        {h: (cell if cell != "" else None)
         for h, cell in zip(table.headings, row.cells)}
        for row in table
    ]
    return pl.DataFrame(rows)


def _string_to_polars_type(type_name: str):
    t = type_name.lower()
    if t.startswith("date"):
        return pl.Date
    return {
        "string": pl.Utf8, "str": pl.Utf8,
        "integer": pl.Int64, "int": pl.Int64, "long": pl.Int64,
        "integer8": pl.Int8, "integer32": pl.Int32,
        "float": pl.Float64, "double": pl.Float64,
        "boolean": pl.Boolean, "bool": pl.Boolean,
        "timestamp": pl.Datetime(time_zone="UTC"),
        "decimal": pl.Decimal, "object": pl.Object,
    }.get(t)
```

Details that earn their keep:

- **`null` vs `nan` cells are distinct**, mirroring Polars' own null/NaN distinction: empty or `null` cells become genuine nulls; the literal `nan` in a float column becomes IEEE NaN. Handle `nan` explicitly if your suite needs it (map the string through `pl.when(...)` before casting).
- **`date(yyyy-MM-dd)`** style parameterised formats let test data stay in whatever shape the upstream source uses, translated to Rust chrono specifiers (not Python strftime).
- **Datetime strings parse to UTC** with `strict=False`, so `2024-12-16T11:00:00Z` and `2024-12-16 11:00:00` both work in tables.

## Comparing DataFrames

Build the comparison on `polars.testing.assert_frame_equal` rather than hand-rolled loops — it produces precise diagnostics on mismatch:

```python
import polars.testing as pl_testing


def compare_polars_dataframes(
    expected: pl.DataFrame,
    actual: pl.DataFrame,
    check_like: bool = True,
    check_row_order: bool = True,
):
    """Unordered-by-default comparison: sort both frames by all columns
    so scenarios do not encode incidental row order."""
    cols = sorted(expected.columns)
    expected = expected.select(cols).sort(by=cols)
    actual = actual.select(sorted(actual.columns)).sort(by=sorted(actual.columns))
    if check_like:
        actual = actual.select(expected.columns)
    pl_testing.assert_frame_equal(
        expected, actual, check_row_order=check_row_order, check_dtypes=False
    )
```

`check_dtypes=False` is deliberate: Gherkin tables state values, and forcing every scenario to also pin exact integer widths makes suites brittle (an `Int64` vs `Int32` difference is rarely the behaviour under test). When dtype *is* the behaviour under test — schema contracts, shrink/cast logic — assert on `df.schema` directly or use Pandera (see [Schema Validation with Pandera](testing.md#schema-validation-with-pandera)).

Pair this with a shared `Then the result DataFrame should match` step that projects the actual frame down to only the columns named in the expected table — the pattern, and the error-capture convention it relies on (`context.result` / `context.error`), are described in the behave guidelines.

## Anatomy of a Pipeline Scenario

The step triad: Given builds frames from tables, When calls the real pipeline function, Then compares.

```gherkin
@unit
Feature: Deduplicate FUELINST data
  Remove duplicate rows keeping the latest publish_time for each
  settlement date/period/fuel type.

  Scenario: Remove duplicates keeping latest publish time
    Given the following FUELINST data
      | publish_time:string  | settlement_date:string | settlement_period:integer | fuel_type:string | generation:integer |
      | 2024-12-16T23:55:00Z | 2024-12-16             | 48                        | WIND             | 5000               |
      | 2024-12-16T23:50:00Z | 2024-12-16             | 48                        | WIND             | 4900               |
      | 2024-12-16T23:55:00Z | 2024-12-16             | 48                        | CCGT             | 2000               |
    When I deduplicate the FUELINST data
    Then the deduplicated FUELINST result should match
      | settlement_date:string | settlement_period:integer | fuel_type:string | generation:integer |
      | 2024-12-16             | 48                        | WIND             | 5000               |
      | 2024-12-16             | 48                        | CCGT             | 2000               |
```

```python
from behave import given, when, then

from common_steps import behave_table_to_polars_dataframe, compare_polars_dataframes
from my_pipeline import deduplicate_fuelinst


@given("the following FUELINST data")
def step_given_fuelinst(context):
    context.input_df = behave_table_to_polars_dataframe(context.table)


@when("I deduplicate the FUELINST data")
def step_when_deduplicate(context):
    context.result = deduplicate_fuelinst(context.input_df.lazy()).collect()


@then("the deduplicated FUELINST result should match")
def step_then_matches(context):
    expected = behave_table_to_polars_dataframe(context.table)
    compare_polars_dataframes(expected, context.result.select(expected.columns))
```

Note the When step: the pipeline function takes and returns a `LazyFrame` (per [the stage contract](pipe-composition.md#functional-composition-with-pipe)); the step collects at the boundary. Scenarios exercise real pipeline stages — they never re-implement the transformation in the step definition.

## Encoding Domain Arithmetic in Scenarios

For numerically subtle transformations, put the worked arithmetic in the scenario description so the specification proves the expected value rather than asserting it by fiat:

```gherkin
  Scenario: Multiple segments with unequal durations use time-weighted average
    BMU ramps 200→500 over 10 minutes then holds 500 for 20 minutes.
    Time-weighted average = (350*10 + 500*20) / 30 = 450 MW.
    Note: a simple unweighted average would give (350+500)/2 = 425 — incorrect.

    Given the following Physical Notification data
      | settlement_period:integer | time_from:string     | time_to:string       | level_from:integer | level_to:integer |
      | 23                        | 2024-12-16T11:00:00Z | 2024-12-16T11:10:00Z | 200                | 500              |
      | 23                        | 2024-12-16T11:10:00Z | 2024-12-16T11:30:00Z | 500                | 500              |
    When I calculate Settlement Period average MW for Physical Notifications
    Then the Settlement Period average result should match
      | settlement_period:integer | avg_mw:integer |
      | 23                        | 450            |
```

The "note the naive answer" line is the most valuable part: it documents the bug the scenario exists to prevent. Scenarios that pin fixed production bugs should say so, naming the symptom.

## Validating Unique Keys

A small helper for the recurring "surrogate key is unique and correctly typed" assertion:

```python
def validate_unique_sk_column(
    data: pl.DataFrame, column_name: str,
    expected_data_type: pl.DataType = pl.Int64,
):
    assert data[column_name].dtype == expected_data_type
    assert data[column_name].is_unique().all()
```

## DuckDB-Backed Pipelines

When the system under test is SQL-on-DuckDB rather than Polars expressions, keep the same table conventions and route through Polars as the intermediary — the Gherkin experience is identical:

```python
import duckdb


def behave_table_to_duckdb_relation(table, con=None):
    con = con or duckdb
    df = behave_table_to_polars_dataframe(table)  # noqa: F841 — referenced by SQL
    return con.sql("SELECT * FROM df")


def compare_duckdb_relations(expected, actual):
    compare_polars_dataframes(expected.pl(), actual.pl())
```

DuckDB queries Polars frames by variable name (see [Integration Patterns](integration.md#integration-patterns)), so the conversion is zero-copy in both directions. One suite can then mix scenarios over Polars pipeline stages and DuckDB views without the feature files revealing which engine sits underneath — which is exactly the point: the specification outlives the engine choice.
