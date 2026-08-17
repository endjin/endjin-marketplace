---
name: python-executable-specifications
description: Use when writing, reviewing, or debugging executable specifications in Python — Gherkin feature files and behave step definitions. Covers BDD project structure, Given/When/Then scenarios, step parameter matching, the context object, hooks and fixtures, tags, Scenario Outlines, configuration (behave.ini), test data management, testing data pipelines with table-driven scenarios, reporting, parallel execution, and BDD anti-patterns. Also use when setting up behave in a project, converting requirements or acceptance criteria into feature files, or choosing between BDD and plain pytest for a piece of code.
license: MIT
---

# Python Executable Specifications (Gherkin + behave)

Executable specifications define expected system behaviour in plain, human-readable Gherkin feature files, backed by Python step definitions that implement the verification. behave is the Python framework that runs them: feature files describe **what** the system should do; step definitions implement **how** to verify it. The result is living documentation — specifications that stay in sync with the codebase because they *are* the tests.

Requires Python 3.9+ and `behave >= 1.3.3` (`uv add behave`). Behave 1.3.0 (August 2025) was the first stable release in over seven years, adding Gherkin v6 support (including the `Rule` keyword), async steps, and improved tag expressions.

## Core Principles

1. **Declarative, not imperative.** Scenarios describe business behaviour ("When the user logs in with valid credentials"), never implementation mechanics ("When the user clicks the Sign In button"). Declarative scenarios survive UI and API redesigns and read as documentation for stakeholders.
2. **3–7 steps per scenario.** Fewer than 3 usually lacks context; more than 7 means the scenario covers multiple behaviours and should be split.
3. **One behaviour per scenario.** Given puts the system in a known state, When performs *the* key action, Then asserts the outcome. A scenario with several When/Then cycles is several scenarios.
4. **Steps share state through `context`, never globals.** Behave layers the context per feature/scenario, so state set in a scenario cannot leak into the next.
5. **Step definitions call the real system, never re-implement it.** A When step that reproduces the logic under test proves nothing.
6. **Reuse steps through parameters, not near-duplicates.** `@then('the response status should be {status_code:d}')` replaces a family of hardcoded variants. Give every step function a distinct, descriptive name — never `step_impl` everywhere.
7. **Setup and teardown belong in hooks and fixtures, not step definitions.** `environment.py` hooks and generator-based fixtures guarantee cleanup even when scenarios fail.
8. **Assertion messages always.** A bare `assert x == y` failure in a BDD run tells the reader nothing; include expected vs actual in the message.

## Canonical Feature and Steps

```gherkin
Feature: User Authentication
    As a registered user
    I want to log in to the system
    So that I can access my account

    Scenario: Successful login with valid credentials
        Given a registered user with email "alice@example.com"
        When the user submits the login form
        Then the response status should be 200
```

```python
from behave import given, when, then


@given('a registered user with email "{email}"')
def step_registered_user(context, email):
    context.user = create_user(email=email)


@when('the user submits the login form')
def step_submit_login(context):
    context.response = context.client.post("/login", data={"email": context.user.email})


@then('the response status should be {status_code:d}')
def step_check_status(context, status_code):
    assert context.response.status_code == status_code, (
        f"Expected {status_code}, got {context.response.status_code}"
    )
```

## Project Layout

```
project/
├── behave.ini                  # paths = tests/bdd/features
└── tests/bdd/
    ├── features/               # .feature files (may be grouped in subfolders)
    ├── steps/                  # step definitions (must stay flat)
    │   └── environment.py      # hooks live next to steps' parent, at features/ level
    └── fixtures/               # recorded API payloads, sample files
```

Run with `uv run behave` (all), `uv run behave --tags @unit` (fast in-memory subset), or `uv run behave tests/bdd/features/my.feature` (one file).

## Reference Files

Read the relevant file **before** writing non-trivial code in that area. Do not read them all up front.

| Read | When |
|---|---|
| `references/why-behave.md` | Deciding whether behave/BDD fits; version history, prerequisites, optional packages |
| `references/project-structure.md` | Setting up a new BDD suite; directory rules behave enforces |
| `references/gherkin-syntax.md` | Writing feature files — keywords, Background, Rules, doc strings, declarative style |
| `references/step-definitions.md` | Writing step functions, the `@step` decorator, discovery rules |
| `references/context-object.md` | Sharing state between steps, built-in attributes, layering, cleanup registration |
| `references/step-parameters.md` | Typed parameters (`{n:d}`), custom type registration, cfparse and regex matchers |
| `references/scenario-outlines.md` | Data-driven scenarios with Examples tables; tables vs outlines |
| `references/environment-hooks.md` | `environment.py` — before/after hooks, execution order, hook parameters |
| `references/fixtures.md` | Generator-based fixtures, tag-driven fixture registry, composite fixtures, cleanup guarantees |
| `references/tags-and-filtering.md` | Tag expressions, conventional tags, tag inheritance |
| `references/assertions.md` | Native asserts, PyHamcrest, soft-assertion pattern |
| `references/configuration.md` | behave.ini / pyproject TOML options, userdata, key CLI flags |
| `references/test-data.md` | Inline tables, external data files, database setup/teardown, per-environment config |
| `references/data-pipelines.md` | Testing data pipelines — typed Gherkin tables, shared DataFrame assertion steps, API fixture mocking, VS Code tooling |
| `references/reporting.md` | JUnit XML, HTML and Allure reports, re-running failures |
| `references/debugging.md` | Logging capture, debugger use, async steps |
| `references/code-organization.md` | Page Object and Service Layer patterns, helpers, mocks, type annotations |
| `references/parallel-execution.md` | BehaveX and other parallelisation options |
| `references/anti-patterns.md` | Reviewing feature files or step code — the nine common failure modes with fixes |
| `references/resources.md` | Official docs and ecosystem links |

## Review Checklist

When reviewing executable specifications, check for:

1. Implementation details leaking into Gherkin (URLs, selectors, field-level typing)
2. Scenarios longer than ~7 steps, or with multiple When/Then cycles
3. Setup/teardown done in step definitions instead of hooks or fixtures
4. `execute_steps()` used for composition where a helper function belongs
5. Assertions without messages
6. Near-duplicate step patterns that a typed parameter would unify
7. Every step function named `step_impl` (breaks IDE navigation and tracebacks)
8. State shared between scenarios via globals or module-level mutables
9. Repeated Given blocks that belong in a `Background:`

## Relationship to Other Skills

For data-pipeline suites, `references/data-pipelines.md` covers the library-agnostic patterns (typed `column:type` table headings, unordered result comparison, error capture, fixture-mocked APIs). If the pipeline under test is built on Polars, the `python-polars` plugin's `bdd-testing.md` reference has the Polars-specific implementations of those utilities.
