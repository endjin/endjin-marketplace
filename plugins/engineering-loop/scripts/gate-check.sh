#!/usr/bin/env bash
# engineering-loop PreToolUse gate: blocks `git commit` when the active Tier-2 node's
# gates are unmet or the staged diff drifts outside the declared scope.
#
# Contract (Claude Code hooks):
#   stdin  — JSON: {"tool_name": "Bash", "tool_input": {"command": "..."}, "cwd": "...", ...}
#   exit 0 — allow; exit 2 — BLOCK (stderr is shown to the model); other — non-blocking error.
#
# Fail-open philosophy: this gate only bites when (a) a loop is active (.engineering-loop/
# exists), (b) the command is a git commit, and (c) jq is available to parse state. Anything
# else — missing state, missing jq, malformed JSON — allows the action (the loop's skills
# still enforce advisorily; the hook is the Tier-2 mechanical backstop).

set -u

command -v jq >/dev/null 2>&1 || exit 0   # no jq → fail open (documented in README)

INPUT="$(cat 2>/dev/null || true)"
[ -n "$INPUT" ] || exit 0

CMD="$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)"
[ -n "$CMD" ] || exit 0

# Only care about git commit (not commit-msg lookups, log greps, etc.).
# Global options are skipped over to reach the subcommand. The value-taking forms are listed
# FIRST so `-C /repo` is consumed as one unit — matching only bare `-flag` would stop at `-C`,
# leave `/repo commit` unmatched, and let `git -C /repo commit` slip the gate entirely.
GIT_COMMIT_RE='(^|[;&|[:space:]])git([[:space:]]+(-[cC][[:space:]]+[^[:space:]]+|--(git-dir|work-tree|namespace|exec-path|super-prefix|config-env)([[:space:]]+|=)[^[:space:]]+|-[^[:space:]]+))*[[:space:]]+commit([[:space:]]|$)'
printf '%s' "$CMD" | grep -qE "$GIT_COMMIT_RE" || exit 0

CWD="$(printf '%s' "$INPUT" | jq -r '.cwd // empty' 2>/dev/null)"
[ -n "$CWD" ] && cd "$CWD" 2>/dev/null

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
STATE="$ROOT/.engineering-loop"
GRAPH="$STATE/work-graph.json"
GATES="$STATE/gates.json"
[ -f "$GRAPH" ] || exit 0                 # no active loop → allow

# Active node = LAST node in graph order with status "executing" or "executed" (most recent wins)
NODE_JSON="$(jq -c '[.nodes[]? | select(.status=="executing" or .status=="executed")] | last // empty' "$GRAPH" 2>/dev/null)"
[ -n "$NODE_JSON" ] || exit 0
NODE_ID="$(printf '%s' "$NODE_JSON" | jq -r '.id')"
TIER="$(printf '%s' "$NODE_JSON" | jq -r '.tier // 1')"

# Only Tier 2 hard-blocks; lower tiers are advisory (enforced by skills, not the hook).
[ "$TIER" = "2" ] || exit 0

# Fail open on an unreadable ledger, per the fail-open contract above: every jq read below
# collapses to "no verdict" on a parse error, which would otherwise turn a single corrupt
# gates.json into a permanent block on every commit in the repo. An ABSENT gates.json is a
# different case and deliberately still gates — it means "no verdicts recorded yet", which is
# exactly the state these gates exist to catch on a fresh run.
if [ -f "$GATES" ] && ! jq -e . "$GATES" >/dev/null 2>&1; then
  echo "engineering-loop: .engineering-loop/gates.json is unreadable (malformed JSON) — Tier-2 hook enforcement is failing open for this commit. Repair the ledger to re-arm the gates." >&2
  exit 0
fi

fail() {  # $1 = message
  echo "engineering-loop gate [node $NODE_ID, Tier 2]: $1" >&2
  echo "Why: Tier-2 gates are mechanical, not advisory (threat-model.md). Cheapest next action is stated above; 'skip' requires a logged human accept-with-justification via the loop's control surface." >&2
  exit 2
}

# gates.json is an APPEND-ONLY ledger shared across runs (state contract: "appended to
# .verdicts[], never clobbered"), so every gate below keys off the LATEST verdict for the
# node+gate rather than the existence of any matching verdict. Both directions matter: an
# earlier attempt's REJECT must not wedge a node whose amended plan has since passed (the Plan
# skill explicitly allows a v2 to pass), and an earlier PASS must not satisfy a gate that has
# since failed. Array order is append order, so `last` is the current verdict — no sort is
# involved, so this does not depend on jq sort stability. Node ids are repo-unique across runs
# (state contract), so scoping by node is already scoping by run.
latest_verdict() {  # $1 = gate, $2 = prosecutor ("" = any) → verdict string, "" if none recorded
  jq -r --arg n "$NODE_ID" --arg g "$1" --arg p "$2" '
    [ .verdicts[]?
      | select(.node == $n and .gate == $g)
      | select($p == "" or .prosecutor == $p)
    ] | last | .verdict // empty
  ' "$GATES" 2>/dev/null || true
}

# 1) Evidence gate: node with required_evidence must have PASS as its latest evidence verdict.
REQ_EV="$(printf '%s' "$NODE_JSON" | jq -r '.required_evidence // false')"
if [ "$REQ_EV" = "true" ]; then
  EV="$(latest_verdict evidence '')"
  case "$EV" in
    PASS) ;;
    '')   fail "BLOCKED: this node carries a quality-attribute claim but no evidence verdict exists in gates.json. Run the pre-registered validation (evidence-designer) before committing." ;;
    *)    fail "BLOCKED: the latest evidence verdict for this node is $EV, not PASS. Re-run the pre-registered validation (evidence-designer) before committing." ;;
  esac
fi

# 2) Plan-prosecution gate: a Tier-2 node must have survived its most recent plan prosecution.
PP="$(latest_verdict prosecution plan)"
case "$PP" in
  PASS) ;;
  '')   fail "BLOCKED: no plan-prosecution verdict recorded for this Tier-2 node. Run plan-prosecutor before executing." ;;
  *)    fail "BLOCKED: the latest plan prosecution recorded $PP for this node. Address the cited lenses (gates.json) and re-plan; the panel does not re-roll on an unchanged plan, so an amended plan needs a fresh prosecution." ;;
esac

# 3) Drift gate: staged files must fall inside the declared scope globs.
if [ "$(latest_verdict drift '')" = "FAIL" ]; then
  fail "BLOCKED: the latest drift audit recorded FAIL (out-of-scope changes). Split the out-of-scope hunks into their own slice or re-declare scope with human sign-off."
fi

SCOPES="$(printf '%s' "$NODE_JSON" | jq -r '.declared_scope.files[]? // empty')"
if [ -n "$SCOPES" ]; then
  STAGED="$(git diff --cached --name-only 2>/dev/null)"
  OUT_OF_SCOPE=""
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    # Loop-state files are exempt from declared scopes (Execute skill: committed separately
    # as "engineering-loop: state" commits) — never drift.
    case "$f" in .engineering-loop/*) continue;; esac
    MATCHED=0
    while IFS= read -r g; do
      [ -n "$g" ] || continue
      case "$f" in $g) MATCHED=1; break;; esac
    done <<EOF
$SCOPES
EOF
    [ $MATCHED -eq 1 ] || OUT_OF_SCOPE="$OUT_OF_SCOPE $f"
  done <<EOF
$STAGED
EOF
  [ -z "$OUT_OF_SCOPE" ] || fail "BLOCKED: staged files outside declared scope:$OUT_OF_SCOPE. One intent per change — unstage them or split into their own slice."
fi

exit 0
