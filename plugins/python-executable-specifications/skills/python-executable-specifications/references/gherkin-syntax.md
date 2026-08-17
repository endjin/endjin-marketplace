# Feature Files and Gherkin Syntax

## Basic Feature File

Feature files use the Gherkin language to describe expected behavior in plain English:

```gherkin
Feature: User Authentication
    As a registered user
    I want to log in to the system
    So that I can access my account

    Scenario: Successful login with valid credentials
        Given a registered user with email "alice@example.com"
        And the user's password is "correct-password"
        When the user submits the login form
        Then the response status should be 200
        And the user should be redirected to the dashboard
```

## Gherkin Keywords

| Keyword | Purpose | Usage |
|---|---|---|
| `Feature:` | Groups related scenarios | One per file, describes the capability being tested |
| `Scenario:` | A single test case | Describes one specific behavior or acceptance criterion |
| `Scenario Outline:` | Parameterized test template | Combined with `Examples:` tables for data-driven testing |
| `Background:` | Shared setup steps | Runs before each scenario in the feature file |
| `Given` | Precondition | Puts the system into a known state |
| `When` | Action | Describes the key action being tested |
| `Then` | Assertion | Verifies the expected outcome |
| `And` / `But` | Continuation | Additional steps inheriting the preceding keyword's type |
| `Examples:` | Data table | Provides parameter values for Scenario Outlines |
| `@tag` | Metadata | Tags for filtering, fixture activation, or documentation |
| `Rule:` | Business rule | Groups related scenarios under a named rule (Gherkin v6, behave 1.3.0+) |
| `Scenario Template:` | Alias | Alternative name for `Scenario Outline:` |

## Declarative vs Imperative Style

Feature files should use a **declarative** style that describes *what* the system should do, not *how*. Declarative scenarios survive UI redesigns without modification and serve as genuine living documentation for stakeholders:

```gherkin
# BAD: Imperative -- exposes implementation mechanics
Scenario: Login
    Given the user navigates to "/login"
    When the user types "alice@example.com" into the email field
    And the user types "password123" into the password field
    And the user clicks the "Sign In" button
    Then the page URL should be "/dashboard"

# GOOD: Declarative -- describes business behavior
Scenario: Successful login
    Given a registered user with email "alice@example.com"
    When the user logs in with valid credentials
    Then the user should see the dashboard
```

**Scenario length guideline**: Aim for 3 to 7 steps per scenario. Fewer than 3 may lack context; more than 7 usually indicates the scenario covers multiple behaviors and should be split.

## Background Steps

Background defines setup steps that run before **every** scenario in the feature file:

```gherkin
Feature: Shopping Cart

    Background:
        Given the store catalogue is loaded
        And a customer is logged in

    Scenario: Add item to empty cart
        When the customer adds "Widget" to the cart
        Then the cart should contain 1 item

    Scenario: Add multiple items
        When the customer adds "Widget" to the cart
        And the customer adds "Gadget" to the cart
        Then the cart should contain 2 items
```

**Background guidelines**:
- Only one `Background` section per feature file (or per `Rule:` block)
- Must appear before any `Scenario` or `Scenario Outline`
- Keep it short (ideally 4 lines or fewer) -- long backgrounds make scenarios harder to read
- Use it only for steps that genuinely apply to every scenario in the file
- Background runs once per Scenario Outline example row, not once per outline

## Multi-line Text (Doc Strings)

Pass large text blocks to steps using triple-quoted doc strings:

```gherkin
Scenario: Parse a JSON configuration
    Given the following configuration
        """
        {
            "database": "postgres",
            "host": "localhost",
            "port": 5432
        }
        """
    When the configuration is parsed
    Then the database type should be "postgres"
```

The text is available in the step definition via `context.text`.

## Rules (Gherkin v6)

The `Rule:` keyword groups related scenarios under a named business rule. Rules correspond to Example Mapping concepts from BDD practice and provide an intermediate level of organization between features and scenarios:

```gherkin
Feature: Membership pricing

    Rule: Members get a 10% discount on all items

        Scenario: Member purchases a single item
            Given a member with an active subscription
            When they purchase a book priced at $20
            Then they should be charged $18

        Scenario: Member purchases multiple items
            Given a member with an active subscription
            When they purchase 3 books priced at $20 each
            Then they should be charged $54

    Rule: Non-members pay full price

        Scenario: Non-member purchases an item
            Given a visitor without a membership
            When they purchase a book priced at $20
            Then they should be charged $20
```

**Rules for Rules**:
- Each `Rule:` can contain its own `Background:`, `Scenario`, and `Scenario Outline` blocks
- Tags on a `Rule:` are inherited by all scenarios within it
- Rules cannot be nested
- The `context.rule` attribute provides access to the current Rule object in hooks
