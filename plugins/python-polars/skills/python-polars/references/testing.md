# Testing

## DataFrame Assertions

```python
from polars.testing import assert_frame_equal, assert_series_equal


def test_transformation():
    input_df = pl.DataFrame({"a": [1, 2, 3], "b": [4, 5, 6]})
    result = my_transform(input_df)
    expected = pl.DataFrame({"a": [1, 2, 3], "c": [5, 7, 9]})
    assert_frame_equal(result, expected)
```

## Flexible Comparison Options

```python
assert_frame_equal(
    result,
    expected,
    check_row_order=False,     # Ignore row ordering (useful for group_by results)
    check_column_order=False,  # Ignore column ordering
    check_dtypes=False,        # Ignore dtype differences
    check_exact=False,         # Allow floating-point tolerance
    atol=1e-8,                 # Absolute tolerance
    rtol=1e-5,                 # Relative tolerance
)
```

## Property-Based Testing with Hypothesis

```python
from polars.testing.parametric import dataframes, series, column
from hypothesis import given, settings


@given(
    df=dataframes(
        cols=[
            column("id", dtype=pl.Int64),
            column("value", dtype=pl.Float64, allow_null=True),
            column("category", dtype=pl.String),
        ],
        min_size=5,
        max_size=100,
    )
)
@settings(max_examples=50)
def test_transformation_property(df):
    result = my_transform(df)
    assert result.shape[0] == df.shape[0]
    assert "new_column" in result.columns
```

> **Note**: The `null_probability` parameter on `column()` was deprecated in v0.20.26; use `allow_null=True` instead. Use `pl.String` (not the deprecated `pl.Utf8` alias).

## Schema Validation with Pandera

```python
import pandera.polars as pa
from pandera.typing.polars import LazyFrame


class UserSchema(pa.DataFrameModel):
    user_id: int = pa.Field(gt=0)
    email: str = pa.Field(str_matches=r"^[\w.]+@[\w.]+\.\w+$")
    age: int = pa.Field(ge=0, le=150)
    score: float = pa.Field(ge=0.0, le=1.0, nullable=True)


# Validate at pipeline boundaries
validated_df = UserSchema.validate(df)


# Use as type annotation with check_types decorator
@pa.check_types
def process_users(df: LazyFrame[UserSchema]) -> pl.LazyFrame:
    return df.filter(pl.col("age") >= 18)
```

## Testing Tips

- Use `check_row_order=False` for group_by results since group-by ordering is not guaranteed
- Create factory functions for test DataFrames to keep tests DRY
- Test lazy and eager code paths separately when your code supports both
- Use `--tb=short` with pytest to avoid overly verbose Polars tracebacks
- Test `.pipe()` stages individually with small in-memory `pl.LazyFrame`s; reserve end-to-end tests for the composition (see [Testing Stages](pipe-composition.md#testing-stages))
- Assert plan equivalence (`piped.explain() == inlined.explain()`) for performance-sensitive pipelines, so a refactor cannot silently insert an optimization barrier
