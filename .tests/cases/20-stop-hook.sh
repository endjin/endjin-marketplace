#!/usr/bin/env bash
# loop-not-closed.sh — Stop hook.  exit 0 = allow the session to end, exit 2 = block.

new_fixture_repo

# One Tier-1 and one Tier-2 node mid-flight, so tier scoping is observable.
MIXED='{"run_id":"r-0002","run_status":"active","nodes":[
  {"id":"n-03","tier":1,"status":"executing"},
  {"id":"n-07","tier":2,"status":"executing"}]}'
T1_ONLY='{"run_id":"r-0002","run_status":"active","nodes":[
  {"id":"n-03","tier":1,"status":"executing"}]}'
DONE='{"run_id":"r-0002","run_status":"active","nodes":[
  {"id":"n-07","tier":2,"status":"done"}]}'
CLOSED='{"run_id":"r-0002","run_status":"closed","nodes":[
  {"id":"n-07","tier":2,"status":"executing"}]}'
NO_RUNID='{"run_status":"active","nodes":[
  {"id":"n-07","tier":2,"status":"executing"}]}'

DIFF_OK="$(v prosecution '"diff"' PASS)"
DIFF_REJ="$(v prosecution '"diff"' REJECT)"
GAUNTLET_ERR="$(v gauntlet null ERROR)"

# Failing verdict belonging to the Tier-1 node, not the Tier-2 one.
T1_REJ="$(V_NODE='"n-03"'; v prosecution '"self"' REJECT)"

# Run-level facts carry node: null and so are not node-scoped.
CI_RED="$(V_NODE=null; v ci null RED)"
CI_GREEN="$(V_NODE=null; v ci null GREEN)"
CI_RED_PREV="$(V_NODE=null; V_RUN='"r-0001"'; v ci null RED)"
CI_RED_NORUN="$(V_NODE=null; V_RUN=null; v ci null RED)"

group 'latest verdict wins per (node, gate, prosecutor)'
graph "$MIXED"
gates "$(verdicts "$DIFF_REJ" "$DIFF_OK")"
check_exit 'REJECT then PASS allows the stop' 0 "$STOP_HOOK" "$(stop_json)"
gates "$(verdicts "$DIFF_OK" "$DIFF_REJ")"
check_exit 'PASS then REJECT blocks the stop' 2 "$STOP_HOOK" "$(stop_json)"
gates "$(verdicts "$GAUNTLET_ERR")"
check_exit 'ERROR counts as failed (never silently passes)' 2 "$STOP_HOOK" "$(stop_json)"

group 'tier scoping'
gates "$(verdicts "$T1_REJ")"
check_exit 'Tier-1 failure does not block, even with a Tier-2 node in flight' 0 "$STOP_HOOK" "$(stop_json)"
graph "$T1_ONLY"; gates "$(verdicts "$DIFF_REJ")"
check_exit 'no Tier-2 node in flight allows' 0 "$STOP_HOOK" "$(stop_json)"
graph "$DONE"; gates "$(verdicts "$DIFF_REJ")"
check_exit 'terminal node is not mid-flight' 0 "$STOP_HOOK" "$(stop_json)"

group 'run scoping for run-level verdicts (node: null)'
graph "$MIXED"
gates "$(verdicts "$CI_RED_PREV")"
check_exit 'CI RED from a previous run allows' 0 "$STOP_HOOK" "$(stop_json)"
gates "$(verdicts "$CI_RED" "$CI_GREEN")"
check_exit 'CI RED then GREEN in this run allows' 0 "$STOP_HOOK" "$(stop_json)"
gates "$(verdicts "$CI_GREEN" "$CI_RED")"
check_exit 'CI GREEN then RED in this run blocks' 2 "$STOP_HOOK" "$(stop_json)"
# Agents omitted `run` historically; dropping those records would silently disarm the guard.
gates "$(verdicts "$CI_RED_NORUN")"
check_exit 'verdict with no run field is still counted' 2 "$STOP_HOOK" "$(stop_json)"
graph "$NO_RUNID"; gates "$(verdicts "$CI_RED")"
check_exit 'graph with no run_id still counts run-level verdicts' 2 "$STOP_HOOK" "$(stop_json)"

group 'guards'
graph "$MIXED"; gates "$(verdicts "$DIFF_REJ")"
check_exit 'stop_hook_active=true allows (no infinite stop loop)' 0 "$STOP_HOOK" "$(stop_json true)"
graph "$CLOSED"; gates "$(verdicts "$DIFF_REJ")"
check_exit 'closed run never blocks' 0 "$STOP_HOOK" "$(stop_json)"

group 'fail-open contract'
graph "$MIXED"; gates 'not json at all {{{'
check_exit 'malformed gates.json fails open' 0 "$STOP_HOOK" "$(stop_json)"
rm_gates
check_exit 'absent gates.json allows' 0 "$STOP_HOOK" "$(stop_json)"
gates "$(verdicts "$DIFF_REJ")"
check_exit_nojq 'no jq fails open' 0 "$STOP_HOOK" "$(stop_json)"
rm_graph
check_exit 'no loop state allows' 0 "$STOP_HOOK" "$(stop_json)"

cleanup_fixture
