#!/usr/bin/env bash
# Shared assertions and fixtures for the engineering-loop test suite.
#
# Sourced by run-tests.sh once, before each case file is sourced. Case files therefore share
# the counters below and MUST NOT call `exit` — use the check_* helpers, which never abort.

: "${REPO_ROOT:?REPO_ROOT must be set by run-tests.sh}"

PLUGIN="$REPO_ROOT/plugins/engineering-loop"
SCRIPTS="$PLUGIN/scripts"
GATE_CHECK="$SCRIPTS/gate-check.sh"
STOP_HOOK="$SCRIPTS/loop-not-closed.sh"
SESSION_HOOK="$SCRIPTS/session-resume.sh"

TESTS_PASS=0
TESTS_FAIL=0
TESTS_SKIP=0

group() { printf '\n  %s\n' "$1"; }

_pass() { TESTS_PASS=$((TESTS_PASS + 1)); printf '    ok    %s\n' "$1"; }
_fail() {
  TESTS_FAIL=$((TESTS_FAIL + 1))
  printf '    FAIL  %s\n' "$1"
  [ -n "${2:-}" ] && printf '          %s\n' "$2"
  return 0
}
skip() { TESTS_SKIP=$((TESTS_SKIP + 1)); printf '    skip  %s (%s)\n' "$1" "${2:-}"; }

# ---------------------------------------------------------------- helpers

# jqr — jq -r with carriage returns stripped.
# The Windows jq build translates stdout to CRLF. Command substitution swallows the trailing
# \r, so the hook scripts are unaffected, but `while read` keeps it and every subsequent path
# or string comparison then fails on Windows only. Use this anywhere jq output is iterated.
jqr() { jq -r "$@" | tr -d '\r'; }

# ---------------------------------------------------------------- generic assertions

# ok_if <label> <cmd...>          — passes when the command exits 0
ok_if() {
  local label="$1"; shift
  if "$@" >/dev/null 2>&1; then _pass "$label"; else _fail "$label" "command failed: $*"; fi
}

# fail_if <label> <cmd...>        — passes when the command exits non-zero
fail_if() {
  local label="$1"; shift
  if "$@" >/dev/null 2>&1; then _fail "$label" "expected failure, but succeeded: $*"; else _pass "$label"; fi
}

# expect_empty <label> <offenders>  — the workhorse for the structural/contract layers.
# Build a newline-separated list of offenders and assert it is empty; on failure the
# offenders themselves are the diagnostic, so no separate lookup is needed.
expect_empty() {
  local label="$1" offenders="$2"
  if [ -z "$offenders" ]; then
    _pass "$label"
  else
    local n; n="$(printf '%s\n' "$offenders" | grep -c .)"
    _fail "$label" "$n offender(s): $(printf '%s' "$offenders" | tr '\n' ' ' | cut -c1-400)"
  fi
}

# expect_eq <label> <want> <got>
expect_eq() {
  if [ "$2" = "$3" ]; then _pass "$1"; else _fail "$1" "want '$2', got '$3'"; fi
}

# ---------------------------------------------------------------- hook invocation

# check_exit <label> <want-exit> <script> <stdin-json>
# Hook contract: exit 0 = allow, exit 2 = block.
check_exit() {
  local label="$1" want="$2" script="$3" stdin="$4" out rc
  out="$(printf '%s' "$stdin" | bash "$script" 2>&1)"; rc=$?
  if [ "$rc" -eq "$want" ]; then
    _pass "$label"
  else
    _fail "$label" "want exit $want, got $rc — $(printf '%s' "$out" | head -1)"
  fi
}

# check_exit_nojq <label> <want-exit> <script> <stdin-json>
# Runs with an empty PATH so `command -v jq` fails at the top of each script, exercising the
# documented no-jq fail-open branch. Shell builtins still work, so the scripts run normally.
# The interpreter must be named by absolute path: bash applies a PATH assignment prefix to the
# lookup of the very command it prefixes, so `PATH='' bash ...` cannot find bash and exits 127.
check_exit_nojq() {
  local label="$1" want="$2" script="$3" stdin="$4" rc
  printf '%s' "$stdin" | PATH='' "${BASH:-/bin/bash}" "$script" >/dev/null 2>&1; rc=$?
  if [ "$rc" -eq "$want" ]; then _pass "$label"; else _fail "$label" "want exit $want, got $rc"; fi
}

# check_stdout <label> <substring> <script> <stdin-json>
check_stdout() {
  local label="$1" want="$2" script="$3" stdin="$4" out
  out="$(printf '%s' "$stdin" | bash "$script" 2>/dev/null)"
  case "$out" in
    *"$want"*) _pass "$label" ;;
    *) _fail "$label" "stdout lacked '$want' — got: $(printf '%s' "$out" | tr '\n' ' ' | cut -c1-200)" ;;
  esac
}

# check_stdout_empty <label> <script> <stdin-json>
# SessionStart writes to the model's context, so silence in repos without loop state matters.
check_stdout_empty() {
  local label="$1" script="$2" stdin="$3" out
  out="$(printf '%s' "$stdin" | bash "$script" 2>/dev/null)"
  if [ -z "$out" ]; then
    _pass "$label"
  else
    _fail "$label" "expected empty stdout, got: $(printf '%s' "$out" | tr '\n' ' ' | cut -c1-200)"
  fi
}

# ---------------------------------------------------------------- fixture repo

FIXTURE_REPO=""

new_fixture_repo() {
  cleanup_fixture
  FIXTURE_REPO="$(mktemp -d)"
  git -C "$FIXTURE_REPO" init -q
  git -C "$FIXTURE_REPO" config user.email test@example.com
  git -C "$FIXTURE_REPO" config user.name "engineering-loop tests"
  mkdir -p "$FIXTURE_REPO/.engineering-loop" "$FIXTURE_REPO/src"
}

cleanup_fixture() {
  [ -n "$FIXTURE_REPO" ] && [ -d "$FIXTURE_REPO" ] && rm -rf "$FIXTURE_REPO"
  FIXTURE_REPO=""
}

graph()     { printf '%s' "$1" > "$FIXTURE_REPO/.engineering-loop/work-graph.json"; }
gates()     { printf '%s' "$1" > "$FIXTURE_REPO/.engineering-loop/gates.json"; }
rm_graph()  { rm -f "$FIXTURE_REPO/.engineering-loop/work-graph.json"; }
rm_gates()  { rm -f "$FIXTURE_REPO/.engineering-loop/gates.json"; }

# ---------------------------------------------------------------- hook stdin builders

commit_json()  { printf '{"tool_name":"Bash","tool_input":{"command":"%s"},"cwd":"%s"}' "${1:-git commit -m x}" "$FIXTURE_REPO"; }
stop_json()    { printf '{"stop_hook_active":%s,"cwd":"%s"}' "${1:-false}" "$FIXTURE_REPO"; }
session_json() { printf '{"cwd":"%s"}' "$FIXTURE_REPO"; }

# ---------------------------------------------------------------- verdict builders
#
# Defaults match the common case (current run, node n-07). Override by assigning V_RUN / V_NODE
# — both take a raw JSON token, so `V_NODE=null` and `V_RUN=null` are expressible.

V_RUN='"r-0002"'
V_NODE='"n-07"'

# v <gate> <prosecutor-json> <verdict>
v() {
  printf '{"run":%s,"node":%s,"gate":"%s","prosecutor":%s,"verdict":"%s","timestamp":"2026-01-01T00:00:00Z"}' \
    "$V_RUN" "$V_NODE" "$1" "$2" "$3"
}

# verdicts <record>...            — wraps records into the gates.json envelope, in append order
verdicts() { local IFS=','; printf '{"verdicts":[%s]}' "$*"; }
