# Step Parameter Types and Matching

## Parse Matcher (Default)

The default matcher uses `parse` syntax inspired by Python's `string.format()`:

```python
@given('there are {count:d} items in the cart')
def step_impl(context, count):
    # count is automatically converted to int
    context.cart = Cart(item_count=count)


@then('the total should be {amount:f}')
def step_impl(context, amount):
    # amount is automatically converted to float
    assert context.cart.total == amount
```

**Built-in parse types** (from the `parse` library):

| Placeholder | Type | Example Match |
|---|---|---|
| `{name}` | `str` | Any text |
| `{name:d}` | `int` | `42`, `-1` (digits with optional sign) |
| `{name:f}` | `float` | `3.14`, `-0.5` (fixed-point) |
| `{name:e}` | `float` | `1.5e10` (floating-point with exponent) |
| `{name:g}` | `float` | General number (d, f, or e) |
| `{name:n}` | `int` | `1,000` (numbers with thousands separators) |
| `{name:b}` | `int` | `0b1010` (binary) |
| `{name:o}` | `int` | `0o17` (octal) |
| `{name:x}` | `int` | `0xff` (hexadecimal) |
| `{name:%}` | `float` | `50%` (converted to 0.5) |
| `{name:w}` | `str` | Alphanumeric + underscore |
| `{name:l}` | `str` | Letters only (ASCII) |
| `{name:S}` | `str` | Non-whitespace |
| `{name:D}` | `str` | Non-digit |
| `{name:ti}` | `datetime` | ISO 8601 format (`2024-01-15T10:30:00`) |
| `{name:tg}` | `datetime` | Global day/month format (`15/01/2024`) |
| `{name:ta}` | `datetime` | US month/day format (`01/15/2024`) |
| `{name:tt}` | `time` | Time (`10:30:00`) |

For the full list of parse types, see the [parse library documentation](https://pypi.org/project/parse/).

## Custom Type Registration

Register custom types for domain-specific parsing:

```python
from behave import register_type
import parse


@parse.with_pattern(r"true|false")
def parse_bool(text):
    return text == "true"


register_type(Bool=parse_bool)


@given('the feature flag is {enabled:Bool}')
def step_impl(context, enabled):
    # enabled is a Python bool
    context.feature_flag = enabled
```

## CFParse Matcher

The cardinality field parse matcher extends `parse` with support for optional and repeated fields:

```python
from behave import use_step_matcher

use_step_matcher("cfparse")


# {values:Type+}  -- one or more
# {values:Type*}  -- zero or more
# {value:Type?}   -- optional (zero or one)
```

## Regular Expression Matcher

For complex matching patterns, use the `re` matcher with named groups:

```python
from behave import when, use_step_matcher

use_step_matcher("re")


@when(r'I search for "(?P<query>[^"]*)" in the (?P<field>title|body|tags) field')
def step_search(context, query, field):
    context.results = search(query=query, field=field)
```

## Switching Matchers

You can switch matchers within a single step file. The matcher resets to the default before each file is loaded:

```python
from behave import given, when, use_step_matcher

use_step_matcher("re")

@given(r'a user named "(?P<name>[A-Za-z]+)"')
def step_user_re(context, name):
    context.user = User(name=name)

use_step_matcher("parse")

@when('the user submits the "{form_name}" form')
def step_submit_parse(context, form_name):
    context.response = submit_form(form_name)
```

**Additional matchers**: Behave also provides a `re0` matcher (Cucumber-compatible regex without auto-added `^` and `$` anchors), selectable via `use_step_matcher("re0")`. The deprecated function `step_matcher()` is an alias for `use_step_matcher()` -- always use the latter.

**Rule**: Prefer the default `parse` matcher unless you need regex power. It produces more readable step patterns and handles type conversion automatically.
