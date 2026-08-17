# Step Definitions

## Basic Step Definitions

Step definitions connect Gherkin steps to Python code using decorators:

```python
from behave import given, when, then


@given('a registered user with email "{email}"')
def step_registered_user(context, email):
    context.user = create_user(email=email)


@when('the user submits the login form')
def step_submit_login(context):
    context.response = context.client.post("/login", data={
        "email": context.user.email,
        "password": context.password,
    })


@then('the response status should be {status_code:d}')
def step_check_status(context, status_code):
    assert context.response.status_code == status_code, (
        f"Expected {status_code}, got {context.response.status_code}"
    )
```

## The `@step` Decorator

The `@step` decorator matches any keyword (Given, When, or Then), making a step reusable across different contexts:

```python
from behave import step


@step('the API base URL is "{url}"')
def step_set_base_url(context, url):
    context.base_url = url
```

**Rule**: Prefer explicit `@given`, `@when`, `@then` decorators over `@step`. The explicit decorators communicate intent -- a `@given` step establishes preconditions, while a `@then` step asserts outcomes. Reserve `@step` for genuinely context-independent steps like configuration.

## Step Definition Discovery

Behave automatically imports all `*.py` files in the `steps/` directory. This means:

- No explicit imports or registration are needed
- All step patterns share a global namespace -- a pattern must be unique across all step files
- Step patterns are matched by the decorator string, not the function name
- If two steps have identical patterns, behave raises an `AmbiguousStep` error
