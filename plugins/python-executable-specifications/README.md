# Python Executable Specifications

Endjin's guidelines for writing executable specifications in Python — Gherkin feature files run by [behave](https://behave.readthedocs.io/) — packaged as an agent skill.

## What you get

**Skill: `python-executable-specifications`** — fires when you write, review, or debug Gherkin feature files and behave step definitions, set behave up in a project, or convert acceptance criteria into scenarios. `SKILL.md` carries the rules that matter everywhere (declarative style, the 3–7 step guideline, one behaviour per scenario, state via `context`, setup in hooks not steps, parameterised step reuse, assertion messages) plus the canonical feature/steps pair and project layout, and routes to twenty reference files read only when the task needs them:

| Reference | Covers |
|---|---|
| `why-behave.md` | When BDD fits, version history, prerequisites |
| `project-structure.md` | Directory rules behave enforces |
| `gherkin-syntax.md` | Keywords, Background, Rules, declarative vs imperative |
| `step-definitions.md` | Decorators, `@step`, discovery |
| `context-object.md` | State sharing, layering, cleanup registration |
| `step-parameters.md` | Typed parameters, custom types, cfparse/regex matchers |
| `scenario-outlines.md` | Data-driven testing with Examples tables |
| `environment-hooks.md` | `environment.py` lifecycle hooks |
| `fixtures.md` | Generator fixtures, tag-driven registry, cleanup guarantees |
| `tags-and-filtering.md` | Tag expressions and conventions |
| `assertions.md` | Native asserts, PyHamcrest, soft assertions |
| `configuration.md` | behave.ini, TOML, userdata, CLI flags |
| `test-data.md` | Tables, external files, database setup/teardown |
| `data-pipelines.md` | Typed Gherkin tables, shared DataFrame assertion steps, API fixture mocking, VS Code tooling |
| `reporting.md` | JUnit, HTML, Allure, re-running failures |
| `debugging.md` | Logging capture, debuggers, async steps |
| `code-organization.md` | Page Object / Service Layer patterns, helpers, mocks |
| `parallel-execution.md` | BehaveX and alternatives |
| `anti-patterns.md` | Nine common BDD failure modes with fixes |
| `resources.md` | Official docs and ecosystem links |

## Install

```shell
/plugin marketplace add endjin/endjin-marketplace
/plugin install python-executable-specifications@endjin
/reload-plugins
```

The skill triggers automatically from its description. To invoke it explicitly: `/python-executable-specifications:python-executable-specifications`.

## Pairs with

The `python-polars` plugin (same marketplace): its `bdd-testing.md` reference implements this plugin's data-pipeline patterns (typed table conversion, unordered frame comparison) specifically for Polars.

## Source

The reference files are generated from `knowledge-base/python-behave-bdd-testing-guidelines.md` in [endjin/python-llm-knowledge-base](https://github.com/endjin/python-llm-knowledge-base). Fix substantive content there and re-split, rather than editing the references in place.

## Portability

The skill follows the [Agent Skills standard](https://github.blog/changelog/2025-12-18-github-copilot-now-supports-agent-skills/) and works unchanged in Claude Code, GitHub Copilot CLI, VS Code, Cursor, and Codex CLI.
