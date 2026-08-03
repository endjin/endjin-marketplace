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

# Only care about git commit (not commit-msg lookups, log greps, etc.)
printf '%s' "$CMD" | grep -qE '(^|[;&|[:space:]])git([[:space:]]+-[^[:space:]]+)*[[:space:]]+commit([[:space:]]|$)' || exit 0

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

fail() {  # $1 = message
  echo "engineering-loop gate [node $NODE_ID, Tier 2]: $1" >&2
  echo "Why: Tier-2 gates are mechanical, not advisory (threat-model.md). Cheapest next action is stated above; 'skip' requires a logged human accept-with-justification via the loop's control surface." >&2
  exit 2
}

# 1) Evidence gate: node with required_evidence must have a PASS verdict recorded.
REQ_EV="$(printf '%s' "$NODE_JSON" | jq -r '.required_evidence // false')"
if [ "$REQ_EV" = "true" ]; then
  EV_OK="$(jq -r --arg n "$NODE_ID" '[.verdicts[]? | select(.node==$n and .gate=="evidence" and .verdict=="PASS")] | length' "$GATES" 2>/dev/null || echo 0)"
  [ "${EV_OK:-0}" -ge 1 ] || fail "BLOCKED: this node carries a quality-attribute claim but no PASS evidence verdict exists in gates.json. Run the pre-registered validation (evidence-designer) before committing."
fi

# 2) Plan-prosecution gate: a Tier-2 node must have survived plan prosecution.
PP_REJ="$(jq -r --arg n "$NODE_ID" '[.verdicts[]? | select(.node==$n and .prosecutor=="plan" and .verdict=="REJECT")] | length' "$GATES" 2>/dev/null || echo 0)"
PP_PASS="$(jq -r --arg n "$NODE_ID" '[.verdicts[]? | select(.node==$n and .prosecutor=="plan" and .verdict=="PASS")] | length' "$GATES" 2>/dev/null || echo 0)"
[ "${PP_REJ:-0}" -eq 0 ] || fail "BLOCKED: plan prosecution recorded REJECT for this node. Address the cited lenses (gates.json) and re-plan; the panel does not re-roll on an unchanged plan."
[ "${PP_PASS:-0}" -ge 1 ] || fail "BLOCKED: no plan-prosecution PASS verdict recorded for this Tier-2 node. Run plan-prosecutor before executing."

# 3) Drift gate: staged files must fall inside the declared scope globs.
DRIFT_FAIL="$(jq -r --arg n "$NODE_ID" '[.verdicts[]? | select(.node==$n and .gate=="drift" and .verdict=="FAIL")] | length' "$GATES" 2>/dev/null || echo 0)"
[ "${DRIFT_FAIL:-0}" -eq 0 ] || fail "BLOCKED: the drift audit recorded FAIL (out-of-scope changes). Split the out-of-scope hunks into their own slice or re-declare scope with human sign-off."

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
