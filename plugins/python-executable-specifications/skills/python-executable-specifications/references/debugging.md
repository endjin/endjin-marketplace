# Debugging and Logging

## Logging Capture

By default, behave captures all logging output and only displays it when a step fails. Key configuration flags:

| Flag | Effect |
|---|---|
| `--logcapture` / `--capture-log` | Enable logging capture (default) |
| `--no-logcapture` / `--no-capture-log` | Disable capture; logs print in real time |
| `--logging-level LEVEL` | Set capture threshold (default: `INFO`) |
| `--logging-format FORMAT` | Custom log format string |
| `--logging-clear-handlers` | Clear existing log handlers during capture |

## Adding Custom Logging to Steps

```python
import logging
from behave import when

logger = logging.getLogger("behave.steps")


@when('the user processes the order')
def step_process_order(context):
    logger.info(f"Processing order for user: {context.user.name}")
    context.result = process_order(context.order)
    logger.debug(f"Order result: {context.result}")
```

When logging capture is enabled (default), these messages appear only on failure. With `--no-logcapture`, they print in real time.

## Using a Debugger

You **must** use `--no-capture` for any debugger to work, because behave captures stdout by default:

```bash
behave --no-capture -n "my scenario name"
```

```python
@when('the problematic step runs')
def step_problematic(context):
    breakpoint()  # Python 3.7+ -- only works with --no-capture
    context.result = do_something()
```

**Auto-debug on failure** via the `after_step` hook:

```python
# features/environment.py
def after_step(context, step):
    if step.status == "failed" and context.config.userdata.getbool("debug_on_error", False):
        import pdb
        pdb.post_mortem(step.exc_traceback)
```

Usage: `behave --no-capture -D debug_on_error=true`

## Async Step Definitions

Behave 1.3.0+ supports async step definitions natively -- just use `async def`:

```python
import asyncio
from behave import when, then


@when('the async service processes the request')
async def step_async_process(context):
    context.result = await context.service.process(context.request)


@then('the result should be available within {timeout:d} seconds')
async def step_check_result(context, timeout):
    result = await asyncio.wait_for(
        context.service.get_result(), timeout=timeout
    )
    assert result is not None
```

For behave < 1.3.0, use the `@async_run_until_complete` decorator from `behave.api.async_step` (deprecated).
