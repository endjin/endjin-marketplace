# Environment Hooks

## Hook Functions

Define hooks in `features/environment.py` to manage setup and teardown at every level of the test lifecycle:

```python
# features/environment.py

def before_all(context):
    """Runs once before the entire test suite."""
    context.config.setup_logging()
    context.base_url = context.config.userdata.get("base_url", "http://localhost:8000")


def after_all(context):
    """Runs once after the entire test suite."""
    pass


def before_feature(context, feature):
    """Runs before each feature file."""
    if "database" in feature.tags:
        context.db = create_test_database()


def after_feature(context, feature):
    """Runs after each feature file."""
    if hasattr(context, "db"):
        context.db.dispose()


def before_scenario(context, scenario):
    """Runs before each scenario."""
    context.session = create_session()


def after_scenario(context, scenario):
    """Runs after each scenario."""
    context.session.rollback()
    context.session.close()


def before_step(context, step):
    """Runs before each step."""
    pass


def after_step(context, step):
    """Runs after each step. Useful for debugging failed steps."""
    if step.status == "failed":
        capture_screenshot(context, step.name)


def before_tag(context, tag):
    """Runs before features/scenarios with a specific tag."""
    if tag == "browser":
        context.browser = create_browser()


def after_tag(context, tag):
    """Runs after features/scenarios with a specific tag."""
    if tag == "browser":
        context.browser.quit()
```

## Hook Execution Order

For a single scenario, hooks execute in this order:

1. `before_all` (once per test run)
2. `before_tag` (for feature-level tags)
3. `before_feature`
4. `before_tag` (for scenario-level tags)
5. `before_scenario`
6. `before_step` / `after_step` (for each step)
7. `after_scenario`
8. `after_tag` (for scenario-level tags)
9. `after_feature`
10. `after_tag` (for feature-level tags)
11. `after_all` (once per test run)

## Hook Parameters

The `feature`, `scenario`, and `step` objects passed to hooks expose:

| Attribute | Description |
|---|---|
| `.name` | The name string from the Gherkin file |
| `.tags` | Set of tags applied to this element |
| `.filename` | Path to the `.feature` file |
| `.line` | Line number in the `.feature` file |
| `.status` | Current status (`"passed"`, `"failed"`, `"skipped"`, `"untested"`) |

**Rule**: Keep automation infrastructure (database connections, browser setup, API client initialization) in hooks, not in step definitions. Steps should express business behavior, not test infrastructure.
