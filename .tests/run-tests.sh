#!/usr/bin/env bash
# Test suite for the engineering-loop plugin.
#
#   bash .tests/run-tests.sh                 run everything
#   bash .tests/run-tests.sh 10 40           run only case files whose name starts 10 / 40
#
# Layers:  10-30 hook behaviour (runs the real scripts against fixture state)
#          40    structure     (manifests, frontmatter, script wiring)
#          50    contracts     (cross-references, enums, registry integrity)
#
# Exits non-zero if any case fails. Requires jq — the hooks themselves need it, and without it
# they fail open, so a suite that "passed" without jq would be testing nothing.

set -u

TESTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$TESTS_DIR/.." && pwd)"
export REPO_ROOT

if ! command -v jq >/dev/null 2>&1; then
  cat >&2 <<'EOF'
error: jq is required but was not found on PATH.

  The hook scripts under test fail open without jq, so running the suite without it would
  report success while exercising none of the gates.

  Linux/devcontainer : sudo apt-get install -y jq
  macOS              : brew install jq
  Windows (Git Bash) : download jq.exe from https://github.com/jqlang/jq/releases
                       and put it somewhere on PATH
EOF
  exit 1
fi

# shellcheck source=lib/assert.sh
. "$TESTS_DIR/lib/assert.sh"

trap cleanup_fixture EXIT

printf 'engineering-loop test suite\n'
printf '  repo   %s\n' "$REPO_ROOT"
printf '  jq     %s\n' "$(jq --version)"

selected=("$@")
matches_selection() {
  [ "${#selected[@]}" -eq 0 ] && return 0
  local base; base="$(basename "$1")"
  local pat
  for pat in "${selected[@]}"; do
    case "$base" in "$pat"*) return 0;; esac
  done
  return 1
}

ran_any=0
for case_file in "$TESTS_DIR"/cases/*.sh; do
  [ -f "$case_file" ] || continue
  matches_selection "$case_file" || continue
  ran_any=1
  printf '\n== %s\n' "$(basename "$case_file" .sh)"
  # shellcheck disable=SC1090
  . "$case_file"
done

if [ "$ran_any" -eq 0 ]; then
  printf '\nno case files matched: %s\n' "${selected[*]}" >&2
  exit 1
fi

printf '\n---------------------------------------------\n'
printf 'passed %s   failed %s   skipped %s\n' "$TESTS_PASS" "$TESTS_FAIL" "$TESTS_SKIP"
[ "$TESTS_FAIL" -eq 0 ] || exit 1
