# Scenario Outlines and Data Tables

## Scenario Outlines

Scenario Outlines run the same scenario template once for each row in the `Examples` table:

```gherkin
Feature: Input Validation

    Scenario Outline: Validate email format
        Given a registration form
        When the user enters email "<email>"
        Then the validation result should be "<result>"

    Examples: Valid emails
        | email              | result  |
        | user@example.com   | valid   |
        | admin@test.co.uk   | valid   |

    Examples: Invalid emails
        | email              | result  |
        | not-an-email       | invalid |
        | @missing-local     | invalid |
        | user@              | invalid |
```

Values in angle brackets (`<email>`) are substituted from the corresponding column. Multiple `Examples:` sections can have descriptive names for logical grouping.

## Data Tables in Steps

Attach tabular data to any step using pipe-delimited tables:

```gherkin
Scenario: Create multiple users
    Given the following users exist
        | name    | email              | role    |
        | Alice   | alice@example.com  | admin   |
        | Bob     | bob@example.com    | editor  |
        | Charlie | charlie@example.com| viewer  |
    When the admin views the user list
    Then all 3 users should be displayed
```

Access table data in step definitions via `context.table`:

```python
@given('the following users exist')
def step_create_users(context):
    for row in context.table:
        create_user(
            name=row["name"],
            email=row["email"],
            role=row["role"],
        )

    # Access column headers
    headers = context.table.headings  # ["name", "email", "role"]

    # Access specific row by index
    first_user = context.table[0]
    assert first_user["name"] == "Alice"
```

## When to Use Each

| Approach | Use When |
|---|---|
| Scenario Outline + Examples | Testing the same behavior with different inputs/outputs |
| Data Tables | Providing structured setup data to a single step |
| Multiple Scenarios | Testing fundamentally different behaviors or user flows |
