# Context Object

## Overview

The `context` object is the primary mechanism for sharing state between steps, hooks, and fixtures. Behave creates and manages it automatically across three layers:

| Layer | Created | Destroyed | Scope |
|---|---|---|---|
| Feature | Before each feature | After each feature | Data shared across all scenarios in a feature |
| Scenario | Before each scenario | After each scenario | Data shared across all steps in a scenario |
| Step | Before each step | After each step | Data local to a single step |

When you assign an attribute to `context`, it is stored in the current innermost layer. When you read an attribute, behave searches from the innermost layer outward.

## Built-in Attributes

```python
context.table           # Data table attached to the current step (Table object or None)
context.text            # Multi-line text attached to the current step (string or None)
context.failed          # True if any step in the current scenario has failed
context.feature         # The current Feature object (name, tags, filename)
context.rule            # The current Rule object (Gherkin v6+, or None)
context.scenario        # The current Scenario object (name, tags, status)
context.tags            # Effective tags for the current scope
context.config          # The behave Configuration object
context.aborted         # True if execution was aborted
context.active_outline  # Current row in a Scenario Outline's Examples table (or None)
context.captured        # Snapshot of captured stdout/stderr/log output (Captured object)
```

**Key methods**:

```python
context.add_cleanup(func, *args, **kwargs)  # Register cleanup for current scope
context.execute_steps(steps_text)           # Parse and execute Gherkin steps programmatically
context.attach(mime_type, data)             # Embed data in reports (e.g., screenshots)
```

> **Note**: `context.log_capture`, `context.stdout_capture`, and `context.stderr_capture` are **deprecated** since v1.2.7. Use `context.captured.log`, `context.captured.stdout`, and `context.captured.stderr` instead.

## Usage Pattern

```python
@given('a database connection')
def step_db_connection(context):
    context.db = create_connection("test_db")
    context.add_cleanup(context.db.close)


@when('the user creates an order with amount {amount:f}')
def step_create_order(context, amount):
    context.order = context.db.execute(
        "INSERT INTO orders (amount) VALUES (?) RETURNING *",
        (amount,),
    )


@then('the order should exist in the database')
def step_verify_order(context):
    result = context.db.execute(
        "SELECT * FROM orders WHERE id = ?",
        (context.order.id,),
    )
    assert result is not None
```

## Cleanup Registration

Use `context.add_cleanup()` to register teardown functions that execute when the current context layer ends:

```python
@given('a temporary file')
def step_temp_file(context):
    context.temp_path = create_temp_file()
    context.add_cleanup(os.remove, context.temp_path)
```

Cleanups run in reverse registration order (LIFO) and execute even if steps fail.

## Context Layer Shadowing

Understanding how context layers interact is critical for avoiding subtle bugs:

- **Writing** an attribute always writes to the **current innermost** layer
- **Reading** an attribute searches from innermost (step) to outermost (test run)
- If you set `context.db` in `before_feature` and then set `context.db` in a step, the step creates a new `context.db` in the scenario layer that **shadows** the feature-level one
- When the scenario ends, the scenario layer is removed and the feature-level `context.db` is visible again (unchanged)
- Mutable objects (lists, dicts) set at the feature level can be accidentally modified from scenario steps because reading returns the same reference

**Reserved attribute names** -- avoid using these for your own data: `feature`, `scenario`, `rule`, `tags`, `table`, `text`, `config`, `active_outline`, `aborted`, `failed`, `captured`.
