# Test suite

Deterministic tests for the `engineering-loop` plugin. No API calls, no cost, no flakiness —
safe to run as often as you like.

```bash
bash .tests/run-tests.sh          # everything
bash .tests/run-tests.sh 10 40    # only case files starting 10 / 40
```

Exits non-zero if anything fails.

## Requirements

`jq`, and nothing else. The hook scripts need it too — without jq they fail open, so a suite
that ran without it would report success while exercising none of the gates. `run-tests.sh`
refuses to start rather than skip silently.

| Platform | Install |
| --- | --- |
| Linux / devcontainer | `sudo apt-get install -y jq` |
| macOS | `brew install jq` |
| Windows (Git Bash) | Download `jq.exe` from [jqlang/jq releases](https://github.com/jqlang/jq/releases) and put it on `PATH` |

On Windows, add the directory to `PATH` in POSIX form (`/c/tools/bin`), not Windows form
(`C:/tools/bin`) — Git Bash will not resolve `jq.exe` from a Windows-style `PATH` entry.

## Layout

```
.tests/
  run-tests.sh              entry point: jq preflight, runs cases/, prints the summary
  lib/assert.sh             assertions, the fixture repo, verdict builders
  cases/10-gate-check.sh    PreToolUse gate on git commit
  cases/20-stop-hook.sh     Stop hook
  cases/30-session-resume.sh SessionStart hook
  cases/40-structure.sh     manifests, hook wiring, frontmatter
  cases/50-contracts.sh     cross-references, registry integrity, verdict schema
```

## What each layer covers

**10–30 — hook behaviour.** Runs the real scripts against a throwaway git repo with fixture
state, asserting the exit code (`0` allow, `2` block). The bulk of this is the latest-verdict
rule: `gates.json` is append-only, so a gate must key off the *last* record for a
`(node, gate, prosecutor)` key. Both directions are tested, because both have been wrong —
a stale `PASS` satisfying a failed gate, and a superseded `REJECT` wedging a node forever.
Also covers tier and run scoping, `git commit` detection (including `git -C <path> commit`,
which once slipped the gate), declared-scope drift, and every fail-open branch.

**40 — structure.** Manifests parse, `hooks.json` points at scripts that exist, and every
skill/agent/command has frontmatter that YAML reads the way the author meant. That last one is
the plugin's silent failure mode: a `SKILL.md` whose frontmatter does not parse loads with
empty metadata, so Claude never invokes the skill and nothing reports an error.

**50 — contracts.** Documentation and registry data agree with the router's canonical state
contract. Cross-references resolve, agents are wired to skills in both directions, registry ids
are unique and cite truths that exist, and every `gate`/`verdict`/`prosecutor` literal in an
agent is in the canonical enum.

## Conventions for new cases

- Case files are **sourced**, not executed, so they share the counters. Never call `exit` —
  use the `check_*` helpers, which record a failure and carry on.
- Prefer `expect_empty` for structural checks: build a list of offenders and assert it is
  empty. The offenders are then their own diagnostic.
- Use `jqr` rather than `jq -r` when piping into `while read`. The Windows jq build emits CRLF;
  command substitution swallows the `\r` but `read` keeps it, which breaks comparisons on
  Windows only.
- Call `new_fixture_repo` at the top of a hook case file and `cleanup_fixture` at the bottom.

## Deliberate omissions

**No YAML parser.** Hand-rolled YAML parsing in shell is exactly the fragility that let the
frontmatter bug ship, so the authoritative parse is delegated to
`claude plugin validate ./plugins/engineering-loop`, which does read `SKILL.md` frontmatter.
The bash checks add precise `file:line` diagnostics on top. Registry checks are targeted greps,
guarded by a shape assertion that fails loudly if the YAML is ever reflowed — without it, a
reformat would make the greps match nothing and report success.

**No behavioural evals.** `registry/canary-known-bad-plan.md` is a ready-made fixture — it
documents the exact lenses a prosecutor must REJECT on, and a prosecutor that PASSes it is
miscalibrated. Exercising it needs headless Claude runs, so it is out of scope here.

**No CI.** Nothing runs this automatically yet.
