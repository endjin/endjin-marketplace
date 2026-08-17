# Code Organization Patterns

## Page Object Pattern (UI Testing)

Encapsulate UI interactions behind page objects to keep step definitions clean:

```python
# features/pages/login_page.py
from selenium.webdriver.common.by import By


class LoginPage:
    def __init__(self, browser):
        self.browser = browser

    def navigate(self):
        self.browser.get("/login")

    def enter_credentials(self, email, password):
        self.browser.find_element(By.ID, "email").send_keys(email)
        self.browser.find_element(By.ID, "password").send_keys(password)

    def submit(self):
        self.browser.find_element(By.ID, "submit-btn").click()

    @property
    def error_message(self):
        return self.browser.find_element(By.CSS_SELECTOR, ".error").text


# features/steps/login_steps.py
from features.pages.login_page import LoginPage


@given('the user is on the login page')
def step_impl(context):
    context.login_page = LoginPage(context.browser)
    context.login_page.navigate()


@when('the user logs in as "{email}" with password "{password}"')
def step_impl(context, email, password):
    context.login_page.enter_credentials(email, password)
    context.login_page.submit()
```

## Service Layer Pattern (API Testing)

Wrap API interactions in service classes:

```python
# features/services/user_service.py
import requests


class UserService:
    def __init__(self, base_url):
        self.base_url = base_url
        self.session = requests.Session()

    def create_user(self, name, email):
        return self.session.post(
            f"{self.base_url}/api/users",
            json={"name": name, "email": email},
        )

    def get_user(self, user_id):
        return self.session.get(f"{self.base_url}/api/users/{user_id}")

    def close(self):
        self.session.close()


# features/environment.py
from features.services.user_service import UserService


def before_scenario(context, scenario):
    context.user_service = UserService(context.base_url)
    context.add_cleanup(context.user_service.close)


# features/steps/api_steps.py
@when('a user is created with name "{name}" and email "{email}"')
def step_impl(context, name, email):
    context.response = context.user_service.create_user(name, email)
```

## Helper Functions for Shared Logic

Extract reusable logic into helper functions rather than using `execute_steps()`:

```python
# features/steps/helpers.py (imported by other step files)

def create_authenticated_user(context, role="viewer"):
    """Create a user and store auth token on context."""
    user = create_user(role=role)
    token = authenticate(user)
    context.user = user
    context.auth_token = token
    return user


# features/steps/auth_steps.py
from features.steps.helpers import create_authenticated_user


@given('an authenticated admin user')
def step_impl(context):
    create_authenticated_user(context, role="admin")


@given('an authenticated viewer')
def step_impl(context):
    create_authenticated_user(context, role="viewer")
```

## Testing with Mocks

Use `unittest.mock.patch` in step definitions, registering `patcher.stop` as a cleanup to ensure mocks are always torn down:

```python
from unittest.mock import patch
from behave import given, when, then


@given('the payment gateway is unavailable')
def step_mock_gateway(context):
    patcher = patch('myapp.services.payment_gateway.charge')
    context.mock_charge = patcher.start()
    context.mock_charge.side_effect = ConnectionError("Gateway unavailable")
    context.add_cleanup(patcher.stop)


@when('the user attempts to pay')
def step_attempt_payment(context):
    context.result = context.payment_service.process_payment(amount=100)


@then('the payment should fail with a gateway error')
def step_check_payment_failure(context):
    assert context.result.status == "failed"
    context.mock_charge.assert_called_once()
```

## Type Annotations

Behave step definitions support Python type annotations. The annotations are purely informational -- behave uses decorator patterns and step matchers (`:d`, `:f`, etc.) for type conversion, not type hints:

```python
from behave import given, then
from behave.runner import Context


@given('there are {count:d} items in stock')
def step_items_in_stock(context: Context, count: int) -> None:
    context.stock = count


@then('the remaining stock should be {expected:d}')
def step_check_stock(context: Context, expected: int) -> None:
    remaining = context.stock - context.order_quantity
    assert remaining == expected, f"Expected {expected}, got {remaining}"
```

> **Caveat**: The `:d` in `{count:d}` performs the actual conversion. Annotating `count: int` without `:d` in the decorator will still receive a `str`. Custom context attributes like `context.user` are dynamically set, so type checkers cannot verify them without additional tooling.

## Step Definition File Organization

Group steps by domain area, not by keyword:

```
# GOOD: Organized by domain
features/steps/
    auth_steps.py         # All Given/When/Then steps for authentication
    order_steps.py        # All Given/When/Then steps for orders
    api_steps.py          # All Given/When/Then steps for API interactions
    common_steps.py       # Truly shared steps (status codes, waiting, etc.)

# BAD: Organized by keyword
features/steps/
    given_steps.py        # All Given steps mixed together
    when_steps.py         # All When steps mixed together
    then_steps.py         # All Then steps mixed together
```
