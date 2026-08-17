# Assertions

## Native Python Assert (Default)

Use Python's built-in `assert` with descriptive messages:

```python
@then('the order total should be {expected:f}')
def step_check_total(context, expected):
    assert context.order.total == expected, (
        f"Expected total {expected}, got {context.order.total}"
    )


@then('the response should contain "{text}"')
def step_check_response_text(context, text):
    assert text in context.response.text, (
        f'Expected "{text}" in response, got: {context.response.text[:200]}'
    )
```

**Rule**: Always include a descriptive failure message in assertions. When a scenario fails, the message is the first thing you see -- `assert x == y` with no message produces unhelpful output like `AssertionError` with no context.

## PyHamcrest (Recommended for Complex Assertions)

PyHamcrest provides composable matchers for more expressive assertions:

```python
from hamcrest import (
    assert_that,
    equal_to,
    has_length,
    greater_than,
    contains_string,
    has_entry,
    has_items,
    is_not,
    empty,
)


@then('the result count should be {expected:d}')
def step_check_count(context, expected):
    assert_that(context.results, has_length(expected))


@then('the response should include the user name')
def step_check_user_in_response(context):
    assert_that(context.response.json(), has_entry("name", equal_to("Alice")))


@then('the error list should not be empty')
def step_check_errors(context):
    assert_that(context.errors, is_not(empty()))
```

## Soft Assertions Pattern

When you need to check multiple conditions without stopping at the first failure:

```python
@then('all user fields should be populated')
def step_check_all_fields(context):
    errors = []
    user = context.user

    if not user.name:
        errors.append("name is empty")
    if not user.email:
        errors.append("email is empty")
    if not user.role:
        errors.append("role is empty")

    assert not errors, f"Unpopulated fields: {', '.join(errors)}"
```
