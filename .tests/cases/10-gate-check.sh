#!/usr/bin/env bash
# gate-check.sh — PreToolUse gate on `git commit`.  exit 0 = allow, exit 2 = block.

new_fixture_repo

T2_EV='{"run_id":"r-0002","run_status":"active","nodes":[
  {"id":"n-07","tier":2,"status":"executing","required_evidence":true,
   "declared_scope":{"files":["src/*"]}}]}'
T2_NOEV='{"run_id":"r-0002","run_status":"active","nodes":[
  {"id":"n-07","tier":2,"status":"executing","required_evidence":false,
   "declared_scope":{"files":["src/*"]}}]}'
T2_STRTIER='{"run_id":"r-0002","run_status":"active","nodes":[
  {"id":"n-07","tier":"2","status":"executing","required_evidence":false}]}'
T2_EXECUTED='{"run_id":"r-0002","run_status":"active","nodes":[
  {"id":"n-07","tier":2,"status":"executed","required_evidence":false}]}'
T1='{"run_id":"r-0002","run_status":"active","nodes":[
  {"id":"n-07","tier":1,"status":"executing","required_evidence":true}]}'
T0='{"run_id":"r-0002","run_status":"active","nodes":[
  {"id":"n-07","tier":0,"status":"executing","required_evidence":true}]}'
# Two mid-flight nodes: the LAST in graph order is the active one, and it is ungated.
MULTI='{"run_id":"r-0002","run_status":"active","nodes":[
  {"id":"n-07","tier":2,"status":"executing","required_evidence":true},
  {"id":"n-08","tier":1,"status":"executing","required_evidence":true}]}'

PLAN_OK="$(v prosecution '"plan"' PASS)"
PLAN_REJ="$(v prosecution '"plan"' REJECT)"
EV_OK="$(v evidence null PASS)"
EV_BAD="$(v evidence null FAIL)"
DRIFT_OK="$(v drift null PASS)"
DRIFT_BAD="$(v drift null FAIL)"

group 'latest verdict wins (gates.json is append-only)'
graph "$T2_EV"

gates "$(verdicts "$PLAN_REJ" "$PLAN_OK" "$EV_OK")"
check_exit 'plan REJECT then PASS (amended v2) allows' 0 "$GATE_CHECK" "$(commit_json)"
gates "$(verdicts "$PLAN_OK" "$PLAN_REJ" "$EV_OK")"
check_exit 'plan PASS then REJECT blocks' 2 "$GATE_CHECK" "$(commit_json)"

gates "$(verdicts "$PLAN_OK" "$EV_BAD" "$EV_OK")"
check_exit 'evidence FAIL then PASS allows' 0 "$GATE_CHECK" "$(commit_json)"
gates "$(verdicts "$PLAN_OK" "$EV_OK" "$EV_BAD")"
check_exit 'evidence PASS then FAIL blocks' 2 "$GATE_CHECK" "$(commit_json)"

gates "$(verdicts "$PLAN_OK" "$EV_OK" "$DRIFT_BAD" "$DRIFT_OK")"
check_exit 'drift FAIL then PASS allows' 0 "$GATE_CHECK" "$(commit_json)"
gates "$(verdicts "$PLAN_OK" "$EV_OK" "$DRIFT_OK" "$DRIFT_BAD")"
check_exit 'drift PASS then FAIL blocks' 2 "$GATE_CHECK" "$(commit_json)"

group 'missing verdicts'
gates "$(verdicts "$EV_OK")"
check_exit 'no plan-prosecution verdict blocks' 2 "$GATE_CHECK" "$(commit_json)"
gates "$(verdicts "$PLAN_OK")"
check_exit 'required_evidence with no evidence verdict blocks' 2 "$GATE_CHECK" "$(commit_json)"
graph "$T2_NOEV"; gates "$(verdicts "$PLAN_OK")"
check_exit 'required_evidence false needs no evidence verdict' 0 "$GATE_CHECK" "$(commit_json)"

group 'tier scoping (only Tier 2 hard-blocks)'
graph "$T1"; gates '{"verdicts":[]}'
check_exit 'Tier 1 is advisory, not blocked' 0 "$GATE_CHECK" "$(commit_json)"
graph "$T0"; gates '{"verdicts":[]}'
check_exit 'Tier 0 is advisory, not blocked' 0 "$GATE_CHECK" "$(commit_json)"
graph "$T2_STRTIER"; gates '{"verdicts":[]}'
check_exit 'tier as string "2" still gates' 2 "$GATE_CHECK" "$(commit_json)"
graph "$T2_EXECUTED"; gates '{"verdicts":[]}'
check_exit 'status "executed" is still mid-flight' 2 "$GATE_CHECK" "$(commit_json)"
graph "$MULTI"; gates '{"verdicts":[]}'
check_exit 'last mid-flight node in graph order wins' 0 "$GATE_CHECK" "$(commit_json)"

group 'command detection — must fire'
graph "$T2_NOEV"; gates '{"verdicts":[]}'
check_exit 'git commit'                    2 "$GATE_CHECK" "$(commit_json 'git commit -m x')"
check_exit 'git -C <path> commit'          2 "$GATE_CHECK" "$(commit_json 'git -C /repo commit -m x')"
check_exit 'git -c <k=v> commit'           2 "$GATE_CHECK" "$(commit_json 'git -c user.name=x commit -m y')"
check_exit 'git --git-dir=<p> commit'      2 "$GATE_CHECK" "$(commit_json 'git --git-dir=/r/.git commit')"
check_exit 'git --git-dir <p> commit'      2 "$GATE_CHECK" "$(commit_json 'git --git-dir /r/.git commit')"
check_exit 'git commit after && in a chain' 2 "$GATE_CHECK" "$(commit_json 'cd /x && git commit -m y')"

group 'command detection — must not fire'
check_exit 'git log --oneline'             0 "$GATE_CHECK" "$(commit_json 'git log --oneline')"
check_exit 'git log --grep=commit'         0 "$GATE_CHECK" "$(commit_json 'git log --grep=commit')"
check_exit 'git -C <p> log --grep=commit'  0 "$GATE_CHECK" "$(commit_json 'git -C /repo log --grep=commit')"
check_exit 'echo commit'                   0 "$GATE_CHECK" "$(commit_json 'echo commit')"

group 'declared-scope drift'
graph "$T2_EV"; gates "$(verdicts "$PLAN_OK" "$EV_OK")"
echo x > "$FIXTURE_REPO/src/a.txt"; echo y > "$FIXTURE_REPO/other.txt"
git -C "$FIXTURE_REPO" add src/a.txt >/dev/null 2>&1
check_exit 'staged file inside declared scope allows' 0 "$GATE_CHECK" "$(commit_json)"
git -C "$FIXTURE_REPO" add other.txt >/dev/null 2>&1
check_exit 'staged file outside declared scope blocks' 2 "$GATE_CHECK" "$(commit_json)"
git -C "$FIXTURE_REPO" reset -q
# Loop state is committed separately and is exempt from every declared scope.
git -C "$FIXTURE_REPO" add -f .engineering-loop/work-graph.json >/dev/null 2>&1
check_exit '.engineering-loop/ state is scope-exempt' 0 "$GATE_CHECK" "$(commit_json)"
git -C "$FIXTURE_REPO" reset -q

group 'fail-open contract'
graph "$T2_EV"; gates 'not json at all {{{'
check_exit 'malformed gates.json fails open' 0 "$GATE_CHECK" "$(commit_json)"
graph "$T2_EV"; rm_gates
check_exit 'absent gates.json still gates (no verdicts yet)' 2 "$GATE_CHECK" "$(commit_json)"
graph "$T2_EV"; gates "$(verdicts "$PLAN_OK" "$EV_OK")"
check_exit_nojq 'no jq fails open' 0 "$GATE_CHECK" "$(commit_json)"
rm_graph
check_exit 'no loop state allows' 0 "$GATE_CHECK" "$(commit_json)"
check_exit 'empty stdin allows' 0 "$GATE_CHECK" ''

cleanup_fixture
