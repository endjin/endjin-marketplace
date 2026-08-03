#!/usr/bin/env bash
# session-resume.sh — SessionStart hook. Always exits 0; what matters is stdout, which is
# injected into the model's context, so silence in unrelated repos is part of the contract.

new_fixture_repo

IN_FLIGHT='{"run_id":"r-0002","run_status":"active","workload":"add caching layer",
  "next":{"node":"n-07","phase":"verify"},
  "nodes":[{"id":"n-05","tier":1,"status":"done"},
           {"id":"n-06","tier":2,"status":"done"},
           {"id":"n-07","tier":2,"status":"executing"}]}'
# Statuses deliberately interleaved, not grouped: jq's group_by sorts internally, so the counts
# must still be right. Locks in the behaviour rather than the assumption.
INTERLEAVED='{"run_id":"r-0002","run_status":"active","workload":"w",
  "nodes":[{"id":"n-01","status":"done"},{"id":"n-02","status":"pending"},
           {"id":"n-03","status":"done"},{"id":"n-04","status":"executing"},
           {"id":"n-05","status":"pending"},{"id":"n-06","status":"done"}]}'
NO_POINTER='{"run_id":"r-0002","run_status":"active","workload":"w",
  "nodes":[{"id":"n-05","status":"done"},{"id":"n-07","status":"pending"}]}'
CLOSED='{"run_id":"r-0002","run_status":"closed","workload":"w","next":null,
  "nodes":[{"id":"n-07","status":"done"}]}'

group 'in-flight run'
graph "$IN_FLIGHT"
check_exit   'always exits 0 (informational only)' 0 "$SESSION_HOOK" "$(session_json)"
check_stdout 'reports an in-flight run'   'in-flight loop run exists' "$SESSION_HOOK" "$(session_json)"
check_stdout 'reports the workload'       'add caching layer'         "$SESSION_HOOK" "$(session_json)"
check_stdout 'uses the next pointer'      'n-07 -> verify'            "$SESSION_HOOK" "$(session_json)"
check_stdout 'labels the pointer source'  'graph pointer'             "$SESSION_HOOK" "$(session_json)"

group 'node status counts'
graph "$INTERLEAVED"
check_stdout 'counts 6 nodes'             '6 total'                   "$SESSION_HOOK" "$(session_json)"
check_stdout 'groups interleaved done'    'done: 3'                   "$SESSION_HOOK" "$(session_json)"
check_stdout 'groups interleaved pending' 'pending: 2'                "$SESSION_HOOK" "$(session_json)"
check_stdout 'groups single executing'    'executing: 1'              "$SESSION_HOOK" "$(session_json)"

group 'pointer fallback'
graph "$NO_POINTER"
check_stdout 'falls back to graph order'  'n-07'                      "$SESSION_HOOK" "$(session_json)"
check_stdout 'labels the fallback'        'heuristic'                 "$SESSION_HOOK" "$(session_json)"

group 'closed run'
graph "$CLOSED"
check_exit   'exits 0'                    0 "$SESSION_HOOK" "$(session_json)"
check_stdout 'reports history, not resume' 'CLOSED loop run'          "$SESSION_HOOK" "$(session_json)"

group 'repos that do not use the loop'
rm_graph
check_exit        'exits 0'  0 "$SESSION_HOOK" "$(session_json)"
check_stdout_empty 'stays silent on stdout (context must not be polluted)' "$SESSION_HOOK" "$(session_json)"

group 'no jq'
graph "$IN_FLIGHT"
check_exit_nojq 'still exits 0' 0 "$SESSION_HOOK" "$(session_json)"

cleanup_fixture
