# Fixtures

## Generator-Based Fixtures

Fixtures encapsulate setup and cleanup logic using Python generators. The code before `yield` runs during setup; the code after runs during cleanup:

```python
from behave import fixture, use_fixture


@fixture
def database_connection(context, **kwargs):
    # SETUP
    context.db = create_connection("test_db")
    yield context.db
    # CLEANUP (runs automatically, even on failure)
    context.db.close()


@fixture
def browser_session(context, browser_type="chrome", **kwargs):
    # SETUP
    context.browser = create_browser(browser_type)
    yield context.browser
    # CLEANUP
    context.browser.quit()
```

## Using Fixtures in Hooks

Activate fixtures from hooks using `use_fixture()`:

```python
from behave import use_fixture


def before_scenario(context, scenario):
    use_fixture(database_connection, context)


def before_feature(context, feature):
    if "ui" in feature.tags:
        use_fixture(browser_session, context, browser_type="chrome")
```

## Cleanup-Based Fixtures

An alternative to generators when cleanup logic is simpler:

```python
@fixture
def api_client(context, **kwargs):
    client = create_api_client(context.base_url)
    context.api = client
    context.add_cleanup(client.close)
    return client
```

## Tag-Based Fixture Registry

Map tags to fixtures for automatic activation:

```python
from behave.fixture import use_fixture_by_tag, fixture_call_params

fixture_registry = {
    "fixture.browser.chrome": fixture_call_params(browser_session, browser_type="chrome"),
    "fixture.browser.firefox": fixture_call_params(browser_session, browser_type="firefox"),
    "fixture.database": database_connection,
}


def before_tag(context, tag):
    if tag.startswith("fixture."):
        return use_fixture_by_tag(tag, context, fixture_registry)
```

Usage in feature files:

```gherkin
@fixture.browser.chrome
Scenario: Submit a form in Chrome
    Given the registration page is loaded
    When the user fills in the form
    Then the form should be submitted successfully
```

## Composite Fixtures

Combine multiple fixtures into one:

```python
from behave.fixture import use_composite_fixture_with, fixture_call_params


@fixture
def full_test_environment(context, **kwargs):
    the_composite = use_composite_fixture_with(context, [
        fixture_call_params(database_connection),
        fixture_call_params(api_client),
        fixture_call_params(browser_session, browser_type="chrome"),
    ])
    return the_composite
```

## Cleanup Guarantees

- If setup fails, all already-registered cleanups still execute
- If a cleanup raises an exception, remaining cleanups still execute; the first exception is re-raised
- Cleanup timing depends on where `use_fixture()` is called -- fixtures activated in `before_scenario` clean up after `after_scenario`
