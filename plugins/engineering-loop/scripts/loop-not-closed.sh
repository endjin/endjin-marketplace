#!/usr/bin/env bash
# engineering-loop Stop hook: refuses to end the session while an active Tier-2 loop run
# has unmet mechanical gates. "A feedback loop only exists if you close it."
#
# Contract: stdin JSON (includes stop_hook_active); exit 0 allow, exit 2 block (stderr → model).
# Fail-open on missing state/jq. Guards against infinite stop-loops via stop_hook_active.

set -u
command -v jq >/dev/null 2>&1 || exit 0

INPUT="$(cat 2>/dev/null || true)"
# If we've already blocked once this stop cycle, let it through — never loop the model forever.
ACTIVE="$(printf '%s' "$INPUT" | jq -r '.stop_hook_active // false' 2>/dev/null)"
[ "$ACTIVE" = "true" ] && exit 0

CWD="$(printf '%s' "$INPUT" | jq -r '.cwd // empty' 2>/dev/null)"
[ -n "$CWD" ] && cd "$CWD" 2>/dev/null
ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
GRAPH="$ROOT/.engineering-loop/work-graph.json"
GATES="$ROOT/.engineering-loop/gates.json"
[ -f "$GRAPH" ] || exit 0

# Only bite when a Tier-2 node is mid-flight with a recorded unmet/failed gate.
# Closed runs never block.
RUN_STATUS="$(jq -r '.run_status // "active"' "$GRAPH" 2>/dev/null)"
[ "$RUN_STATUS" = "closed" ] && exit 0

BLOCKING="$(jq -r '
  [.nodes[]? | select(((.tier==2) or (.tier=="2")) and (.status=="executing" or .status=="executed" or .status=="verified"))] | length
' "$GRAPH" 2>/dev/null || echo 0)"
[ "${BLOCKING:-0}" -ge 1 ] || exit 0

# Count failed verdicts ONLY for nodes still mid-flight — a killed/blocked/done node's
# permanent FAIL (e.g. a legitimately evidence-failed node) must not wedge future stops.
# ERROR counts as failed: a malformed/errored prosecution must never silently pass the guard.
FAILED="$(jq -r '
  ([.nodes[]? | select(.status=="executing" or .status=="executed" or .status=="verified") | .id]) as $active
  | input
  | [.verdicts[]? | select((.verdict=="REJECT" or .verdict=="FAIL" or .verdict=="RED" or .verdict=="ERROR")
      and ((.node == null) or (.node as $n | $active | index($n))))] | length
' "$GRAPH" "$GATES" 2>/dev/null || echo 0)"
if [ "${FAILED:-0}" -ge 1 ]; then
  echo "engineering-loop: a Tier-2 node is mid-flight with failed/unmet gates in .engineering-loop/gates.json." >&2
  echo "Close the loop before stopping: address the cited gate, or hand back explicitly ('handback' / 'abort' via the control surface) so the state records a human decision rather than a silent stall." >&2
  exit 2
fi
exit 0
