#!/usr/bin/env bash
# engineering-loop SessionStart hook: if a loop run is in flight in this repo, print a resume
# summary so the loop survives compaction and new sessions. Output on stdout is added to the
# model's context. Always exits 0 — purely informational.

set -u
INPUT="$(cat 2>/dev/null || true)"
if command -v jq >/dev/null 2>&1 && [ -n "$INPUT" ]; then
  CWD="$(printf '%s' "$INPUT" | jq -r '.cwd // empty' 2>/dev/null)"
  [ -n "$CWD" ] && cd "$CWD" 2>/dev/null
fi
ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
GRAPH="$ROOT/.engineering-loop/work-graph.json"
# No loop state: stay silent on stdout (session context must not be polluted for repos that
# don't use the loop) but say so on stderr, so a manual invocation is distinguishable from a
# broken hook.
[ -f "$GRAPH" ] || { echo "engineering-loop: no loop state in this repo (nothing to resume)." >&2; exit 0; }

if command -v jq >/dev/null 2>&1; then
  STATUS="$(jq -r '.run_status // "active"' "$GRAPH" 2>/dev/null)"
  if [ "$STATUS" = "closed" ]; then
    echo "engineering-loop: a CLOSED loop run exists at $ROOT/.engineering-loop/ (history; /engloop starts a fresh run)."
    echo "  To inspect the history: read work-graph.json, gates.json, and kaizen-log.md. Overlay registry lessons/lenses remain active for future runs."
    exit 0
  fi
  echo "engineering-loop: an in-flight loop run exists at $ROOT/.engineering-loop/."
  jq -r '
    "  workload: \(.workload // "unknown")",
    "  nodes: \([.nodes[]?] | length) total — " +
      ([.nodes[]? | .status] | group_by(.) | map("\(.[0]): \(length)") | join(", ")),
    # authoritative pointer first; graph-order heuristic only as fallback
    (if .next != null
      then "  next: \(.next.node // "run-level") -> \(.next.phase) (graph pointer)"
      else "  next: \([.nodes[]? | select(.status=="pending" or .status=="planned" or .status=="executing" or .status=="executed" or .status=="verified")] | first | .id // "none") (heuristic — no pointer)"
     end)
  ' "$GRAPH" 2>/dev/null
else
  # No jq: cheap grep-based closed check so a finished run is not reported in-flight forever.
  if grep -q '"run_status"[[:space:]]*:[[:space:]]*"closed"' "$GRAPH" 2>/dev/null; then
    echo "engineering-loop: a CLOSED loop run exists at $ROOT/.engineering-loop/ (history; /engloop starts a fresh run)."
    echo "  To inspect the history: read work-graph.json, gates.json, and kaizen-log.md. Overlay registry lessons/lenses remain active for future runs."
    exit 0
  fi
  echo "engineering-loop: an in-flight loop run exists at $ROOT/.engineering-loop/."
  echo "  (jq not installed: node summary unavailable, and Tier-2 hook enforcement is FAIL-OPEN/advisory — install jq to arm mechanical gates.)"
fi
echo "  To continue: /engloop (resumes from state). To inspect: read work-graph.json and gates.json. To abandon: 'abort' records the decision."
exit 0
