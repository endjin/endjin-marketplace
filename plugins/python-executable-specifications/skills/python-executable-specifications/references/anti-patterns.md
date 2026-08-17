# Common Anti-Patterns

## Implementation Details in Gherkin

Feature files should describe **business behavior**, not implementation details:

```gherkin
# BAD: Exposes UI implementation details
Scenario: Login
    Given I navigate to "http://localhost:8000/auth/login"
    When I type "alice@example.com" into the "#email-input" field
    And I type "password123" into the "#password-input" field
    And I click the "#submit-btn" button
    Then the element "#dashboard-header" should contain "Welcome"

# GOOD: Describes business behavior
Scenario: Successful login
    Given a registered user with email "alice@example.com"
    When the user logs in with valid credentials
    Then the user should see the dashboard welcome message
```

## Overly Long Scenarios

Each scenario should test a single behavior. Split complex flows into multiple scenarios:

```gherkin
# BAD: Tests multiple behaviors in one scenario
Scenario: Full user journey
    Given a new user registers
    And the user logs in
    And the user creates a project
    And the user invites a collaborator
    And the collaborator accepts
    Then both users should see the project

# GOOD: Focused on one behavior
Scenario: User creates a project
    Given an authenticated user
    When the user creates a project named "My Project"
    Then the project should appear in the user's project list
```

## Setup and Teardown in Step Definitions

Infrastructure concerns belong in hooks, not steps:

```python
# BAD: Database setup in a step definition
@given('the database is ready')
def step_impl(context):
    context.db = create_connection("test_db")
    context.db.execute("CREATE TABLE IF NOT EXISTS users ...")
    context.db.execute("DELETE FROM users")

# GOOD: Database lifecycle managed in hooks
# features/environment.py
def before_scenario(context, scenario):
    context.db = create_connection("test_db")
    context.db.begin()

def after_scenario(context, scenario):
    context.db.rollback()
    context.db.close()
```

## Overusing `execute_steps()`

Calling steps from within steps obscures the test flow and makes debugging harder:

```python
# BAD: Step composition via execute_steps
@given('an authenticated admin on the dashboard')
def step_impl(context):
    context.execute_steps('''
        Given a registered user with role "admin"
        When the user logs in with valid credentials
        Then the user should see the dashboard
    ''')

# GOOD: Shared helper function
@given('an authenticated admin on the dashboard')
def step_impl(context):
    context.user = create_user(role="admin")
    context.auth_token = authenticate(context.user)
    context.response = navigate_to_dashboard(context.auth_token)
```

## Missing Assertion Messages

Bare assertions produce unhelpful error output:

```python
# BAD: No context on failure
@then('the status should be {expected:d}')
def step_impl(context, expected):
    assert context.response.status_code == expected

# GOOD: Descriptive failure message
@then('the status should be {expected:d}')
def step_impl(context, expected):
    assert context.response.status_code == expected, (
        f"Expected status {expected}, got {context.response.status_code}. "
        f"Response body: {context.response.text[:500]}"
    )
```

## Duplicate Step Patterns

Since all step files share a global namespace, duplicate patterns cause `AmbiguousStep` errors:

```python
# BAD: Same pattern in two different files

# auth_steps.py
@given('a user with name "{name}"')
def step_auth_user(context, name):
    context.user = AuthUser(name=name)

# order_steps.py
@given('a user with name "{name}"')
def step_order_user(context, name):
    context.user = OrderUser(name=name)

# GOOD: Disambiguate with context-specific language

# auth_steps.py
@given('a registered user named "{name}"')
def step_auth_user(context, name):
    context.user = AuthUser(name=name)

# order_steps.py
@given('a customer named "{name}"')
def step_order_user(context, name):
    context.customer = OrderUser(name=name)
```

## Using `step_impl` for All Functions

The function name `step_impl` appears in many tutorials but makes debugging difficult because stack traces show the same name everywhere:

```python
# BAD: Every step named step_impl
@given('a user')
def step_impl(context):  # Which step_impl failed?
    context.user = create_user()

@when('the user logs in')
def step_impl(context):  # Stack trace is unhelpful
    context.response = login(context.user)

# GOOD: Descriptive function names
@given('a user')
def step_create_user(context):
    context.user = create_user()

@when('the user logs in')
def step_submit_login(context):
    context.response = login(context.user)
```

## Shared Mutable State Between Scenarios

Each scenario must be independently runnable. Never rely on state from a previous scenario:

```python
# BAD: Feature-level mutable list modified by scenario steps
def before_feature(context, feature):
    context.shared_list = []  # Feature-level attribute

@when('an item is added')
def step_add_item(context):
    context.shared_list.append("item")  # Mutates feature-level list across scenarios!

# GOOD: Each scenario gets its own list
def before_scenario(context, scenario):
    context.items = []  # Scenario-level, fresh each time
```

## Not Using Background

Repeating identical `Given` steps across every scenario instead of using `Background`:

```gherkin
# BAD: Repeated setup in every scenario
Scenario: View products
    Given the store is open
    And the user is logged in
    When the user views the product list
    Then products should be displayed

Scenario: Search products
    Given the store is open
    And the user is logged in
    When the user searches for "widget"
    Then matching products should be displayed

# GOOD: Shared setup in Background
Background:
    Given the store is open
    And the user is logged in

Scenario: View products
    When the user views the product list
    Then products should be displayed

Scenario: Search products
    When the user searches for "widget"
    Then matching products should be displayed
```
