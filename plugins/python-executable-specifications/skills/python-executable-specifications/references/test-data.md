# Test Data Management

## Inline Data with Tables

For small, scenario-specific datasets, use Gherkin data tables:

```gherkin
Scenario: Calculate order totals
    Given the following order items
        | product   | quantity | unit_price |
        | Widget    | 2        | 10.00      |
        | Gadget    | 1        | 25.00      |
    When the order total is calculated
    Then the total should be 45.00
```

## Parameterized Data with Scenario Outlines

For testing the same logic with multiple inputs:

```gherkin
Scenario Outline: Validate discount tiers
    Given a customer with lifetime spend of <spend>
    When the discount tier is calculated
    Then the discount should be <discount>%

    Examples:
        | spend     | discount |
        | 0         | 0        |
        | 500       | 5        |
        | 1000      | 10       |
        | 5000      | 15       |
```

## External Data Files

For large or shared datasets, load from files:

```python
import json


@given('test data is loaded from "{filename}"')
def step_load_test_data(context, filename):
    with open(f"features/test_data/{filename}") as f:
        context.test_data = json.load(f)
```

## Database Setup and Teardown

Use hooks and transactions for repeatable database state:

```python
# features/environment.py

def before_all(context):
    context.db_engine = create_engine("sqlite:///test.db")
    Base.metadata.create_all(context.db_engine)


def before_scenario(context, scenario):
    context.db_session = Session(context.db_engine)
    context.db_session.begin_nested()  # SAVEPOINT for rollback


def after_scenario(context, scenario):
    context.db_session.rollback()
    context.db_session.close()


def after_all(context):
    Base.metadata.drop_all(context.db_engine)
    context.db_engine.dispose()
```

## Environment-Specific Configuration

Use userdata for environment-specific values instead of hardcoding:

```python
def before_all(context):
    env = context.config.userdata.get("environment", "test")

    config = {
        "test": {"db_url": "sqlite:///test.db", "api_url": "http://localhost:8000"},
        "staging": {"db_url": "postgresql://staging/db", "api_url": "https://staging.example.com"},
    }

    context.db_url = config[env]["db_url"]
    context.api_url = config[env]["api_url"]
```
