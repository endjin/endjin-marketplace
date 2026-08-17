# Tags and Filtering

## Applying Tags

Tags are prefixed with `@` and placed above Feature, Scenario, or Scenario Outline declarations:

```gherkin
@authentication @critical
Feature: User Login

    @smoke
    Scenario: Valid login
        Given a registered user
        When the user logs in with valid credentials
        Then the login should succeed

    @slow @regression
    Scenario: Brute force protection
        Given a registered user
        When 10 failed login attempts are made
        Then the account should be locked
```

## Tag Expressions

Behave supports boolean tag expressions for precise test selection:

| Expression | Meaning |
|---|---|
| `@smoke` | Scenarios tagged `@smoke` |
| `not @slow` | Exclude scenarios tagged `@slow` |
| `@smoke and @critical` | Must have both tags |
| `@smoke or @regression` | Must have either tag |
| `(@smoke or @regression) and not @slow` | Complex grouping |
| `@api.*` | Wildcard: any tag starting with `api.` |

## Command-Line Usage

```bash
behave --tags="@smoke"                          # Run only smoke tests
behave --tags="not @slow"                       # Exclude slow tests
behave --tags="@regression and not @wip"        # Regression tests, excluding work-in-progress
behave --tags="@api.* and not @api.deprecated"  # API tests excluding deprecated
```

## Tag Inheritance

Scenario-level tags combine with feature-level tags. A scenario inside a feature tagged `@authentication` inherits that tag:

```python
def before_scenario(context, scenario):
    if "authentication" in scenario.effective_tags:
        context.auth_client = create_auth_client()
```

## Conventional Tags

| Tag | Purpose |
|---|---|
| `@wip` | Work in progress -- run with `behave -w` |
| `@smoke` | Quick sanity checks for CI/CD pipeline gates |
| `@regression` | Full regression suite |
| `@slow` | Long-running tests to exclude from fast feedback loops |
| `@skip` or `@not_implemented` | Scenarios to skip (configure in `default_tags`) |
| `@fixture.<name>` | Activate a registered fixture |
