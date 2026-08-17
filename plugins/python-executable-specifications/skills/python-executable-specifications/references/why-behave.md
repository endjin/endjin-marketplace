# Why Behave

Behave is a behavior-driven development (BDD) testing framework for Python that uses the Gherkin language to define tests in plain, human-readable specification files. Tests are written as Feature files describing expected system behavior, backed by Python step definitions that implement the test logic. This separation between specification and implementation makes behave particularly effective for teams where non-technical stakeholders contribute to defining acceptance criteria.

Behave follows the Cucumber pattern - feature files describe **what** the system should do, while step definitions implement **how** to verify it. The framework discovers step files automatically, manages test lifecycle through hooks, and provides a layered context object for sharing state between steps without global variables.

Behave 1.3.0 (August 2025) was the first stable release in over seven years, adding Gherkin v6 support (including the `Rule` keyword), async step support, and improved tag expressions. The current stable release is **1.3.3** (September 2025).

## Why Behave

- **Living Documentation**: Feature files serve as both executable tests and human-readable specifications that stay in sync with the codebase
- **Gherkin Syntax**: Given/When/Then structure enforces clear separation between preconditions, actions, and assertions
- **Automatic Discovery**: All Python files in the `steps/` directory are imported automatically -- no manual registration or wiring required
- **Lifecycle Hooks**: Fine-grained hooks (`before_all`, `before_feature`, `before_scenario`, `before_step` and their `after_*` counterparts) enable clean setup and teardown at every level
- **Fixtures System**: Generator-based fixtures with automatic cleanup, composable via a fixture registry
- **Tag-Based Filtering**: Tag expressions enable selective test execution, fixture activation, and environment-specific behavior
- **Data-Driven Testing**: Scenario Outlines with Examples tables support parameterized testing without code duplication

## Prerequisites

- **Python 3.9+** (behave supports Python 2.7 and 3.5 through 3.13, but 3.9+ is recommended for modern projects; Python 2.7 support will be dropped in 1.4.x)
- **behave >= 1.3.3** (`uv add behave`)
The following supplementary packages are potential additions based on specific needs.  By default we tend to find the core `behave` package is sufficient.
- Optional: **PyHamcrest** for expressive assertions (`uv add PyHamcrest`)
- Optional: **allure-behave** for rich test reporting (`uv add allure-behave`)
- Optional: **behave-html-pretty-formatter** for HTML reports (`uv add behave-html-pretty-formatter`)
