# Project Structure

## Minimum Required Structure

Behave requires a `features/` directory containing `.feature` files and a `steps/` subdirectory with Python step definitions:

```
project_root/
    features/
        my_feature.feature
        steps/
            steps.py
```

## Recommended Production Structure

For larger projects, organize feature files by domain area and step definitions by responsibility:

```
project_root/
    features/
        auth/
            login.feature
            registration.feature
        orders/
            create_order.feature
            cancel_order.feature
        api/
            users_api.feature
            products_api.feature
        environment.py
        steps/
            auth_steps.py
            order_steps.py
            api_steps.py
            common_steps.py
    behave.ini
    pyproject.toml
```

## Key Structure Rules

- The `features/` directory is the default root -- behave scans it recursively for `.feature` files
- The `steps/` directory must be directly inside `features/` -- behave imports all `*.py` files in it automatically at startup
- The `environment.py` file (optional) sits directly inside `features/` for lifecycle hooks
- Feature files can be nested in subdirectories for organization; behave discovers them recursively
- Step definition files can have any name -- behave loads all Python files in `steps/` regardless of naming

> **Note**: All step definitions share a single global namespace. A step pattern defined in `auth_steps.py` is available to scenarios in `orders/create_order.feature`. This is intentional -- it enables reuse, but requires unique step patterns across all files.
