#!/usr/bin/env bash
# Internal contracts: the documentation and registry data have to agree with each other and
# with the router's canonical state contract, because nothing at runtime checks that they do.
#
# There is no YAML parser here by design (see .tests/README.md). The registry files are
# machine-shaped and consistently formatted, so targeted greps are reliable — but only while
# that formatting holds, which is why the shape guard below exists.

ROUTER="$PLUGIN/skills/engineering-loop/SKILL.md"
TRUTHS="$PLUGIN/references/method/first-principles.md"
LENSES="$PLUGIN/registry/lenses.yaml"
CHECKLIST="$PLUGIN/registry/plan-checklist.yaml"

# Paths that are deliberately absent from the seed: kaizen creates them at runtime in the user
# or project overlay, never in the plugin. Anything else that fails to resolve is doc rot.
OVERLAY_ONLY='registry/lessons.yaml'

group 'cross-references resolve'
expect_empty 'every referenced references/ path exists' "$(
  cd "$PLUGIN" || exit
  grep -rhoE 'references/[a-z-]+/[a-z0-9-]+\.md' --include=*.md . | sort -u | while read -r p; do
    [ -f "$p" ] || echo "$p"
  done
)"
expect_empty 'every referenced registry/ path exists or is a known overlay' "$(
  cd "$PLUGIN" || exit
  grep -rhoE 'registry/[a-z0-9-]+\.(yaml|md)' --include=*.md . | sort -u | while read -r p; do
    [ -f "$p" ] && continue
    printf '%s\n' "$OVERLAY_ONLY" | grep -qx "$p" && continue
    echo "$p"
  done
)"
expect_empty 'the overlay allowlist has no stale entries' "$(
  cd "$PLUGIN" || exit
  printf '%s\n' "$OVERLAY_ONLY" | while read -r p; do
    [ -f "$p" ] && echo "$p now exists as a seed — drop it from OVERLAY_ONLY"
  done
)"

group 'agents are wired up'
expect_empty 'every agent is referenced by a skill or command' "$(
  for f in "$PLUGIN"/agents/*.md; do
    n="$(basename "$f" .md)"
    grep -rql "$n" "$PLUGIN/skills" "$PLUGIN/commands" >/dev/null 2>&1 || echo "orphan: $n"
  done
)"
expect_empty 'every agent named in a skill or command exists' "$(
  grep -rhoE '\b(work-surveyor|evidence-designer|plan-prosecutor|diff-prosecutor|changeset-drift-auditor|ci-watcher|review-ingestor|waste-hunter)\b' \
    "$PLUGIN/skills" "$PLUGIN/commands" 2>/dev/null | sort -u | while read -r n; do
    [ -f "$PLUGIN/agents/$n.md" ] || echo "missing agent file: $n"
  done
)"

group 'registry shape and integrity'
# Guard the assumption the greps below rest on: if someone reflows the YAML, these fail loudly
# rather than quietly matching nothing and reporting success.
expect_empty 'registry entries keep the expected line shape' "$(
  for f in "$LENSES" "$CHECKLIST"; do
    n="$(grep -cE '^  - id: [a-z0-9-]+$' "$f")"
    [ "$n" -gt 0 ] || echo "no '  - id: <slug>' entries found in $(basename "$f") — reformatted?"
  done
)"
expect_empty 'lens ids are unique' "$(
  grep -E '^  - id:' "$LENSES" | sed 's/.*id: //' | sort | uniq -d
)"
expect_empty 'checklist ids are unique' "$(
  grep -E '^  - id:' "$CHECKLIST" | sed 's/.*id: //' | sort | uniq -d
)"
expect_empty 'every registry status is a documented value' "$(
  grep -hE '^\s+status:' "$LENSES" "$CHECKLIST" | sed 's/.*status:[[:space:]]*//' \
    | sort -u | grep -vE '^(proposed|active|dormant|retired)$' || true
)"
expect_empty 'every lens cites a truth defined in first-principles.md' "$(
  defined="$(grep -oE '^\*\*[0-9]+\.' "$TRUTHS" | tr -d '*.')"
  grep -oE '^\s+truth: [0-9]+' "$LENSES" | grep -oE '[0-9]+' | sort -nu | while read -r t; do
    printf '%s\n' "$defined" | grep -qx "$t" || echo "undefined truth: $t"
  done
)"
expect_empty 'every lens carries the required keys' "$(
  awk '
    /^  - id: / { if (id != "") check(); id = $3; q = r = a = s = 0; next }
    /^    question:/     { q = 1 } /^    reject_if:/ { r = 1 }
    /^    applies_when:/ { a = 1 } /^    status:/    { s = 1 }
    END { if (id != "") check() }
    function check() {
      if (!q) print id " missing question"; if (!r) print id " missing reject_if"
      if (!a) print id " missing applies_when"; if (!s) print id " missing status"
    }
  ' "$LENSES"
)"

group 'verdict schema matches the router state contract'
# The router at skills/engineering-loop/SKILL.md is the single canonical schema; agents that
# drift from it write records the hooks cannot read.
GATE_ENUM='prosecution evidence drift gauntlet ci review'
VERDICT_ENUM='PASS REJECT FAIL UNTESTABLE GREEN RED STALLED NO_RUNS ABSENT RESOLVED OPEN ERROR'

expect_empty 'every gate literal in an agent is in the canonical enum' "$(
  grep -rhoE '"gate":[[:space:]]*"[a-z_]+"' "$PLUGIN/agents" | sed 's/.*"\([a-z_]*\)"$/\1/' | sort -u \
  | while read -r g; do
      printf '%s\n' $GATE_ENUM | grep -qx "$g" || echo "unknown gate: $g"
    done
)"
expect_empty 'every verdict literal in an agent is in the canonical enum' "$(
  grep -rhoE '"verdict":[[:space:]]*"[A-Z_|]+"' "$PLUGIN/agents" | sed 's/.*"\([A-Z_|]*\)"$/\1/' \
  | tr '|' '\n' | sort -u | while read -r vv; do
      [ -n "$vv" ] || continue
      printf '%s\n' $VERDICT_ENUM | grep -qx "$vv" || echo "unknown verdict: $vv"
    done
)"
expect_empty 'every prosecutor literal in an agent is in the canonical enum' "$(
  grep -rhoE '"prosecutor":[[:space:]]*("[a-z]+"|null)' "$PLUGIN/agents" \
  | sed 's/.*:[[:space:]]*//' | tr -d '"' | sort -u | while read -r p; do
      case "$p" in plan|diff|self|null) ;; *) echo "unknown prosecutor: $p";; esac
    done
)"
# Every verdict-writing agent must record which run the verdict belongs to. Without it the Stop
# hook cannot scope run-level facts (node: null) to the current run, and a previous run's CI
# failure keeps blocking the session.
expect_empty 'every verdict-writing agent records the run field' "$(
  for f in "$PLUGIN"/agents/*.md; do
    grep -q '"gate":' "$f" || continue
    grep -q '"run":' "$f" || echo "no run field: $(basename "$f")"
  done
)"

group 'canonical vocabularies'
expect_empty 'next.phase tokens are the canonical seven' "$(
  sed -n '/next.phase..uses exactly the canonical phase tokens/,/metrics ledger/p' "$ROUTER" \
  | grep -oE '`(frame|plan|execute|verify|self-review|reconcile|learn)`' | tr -d '`' | sort -u \
  | while read -r p; do
      case "$p" in frame|plan|execute|verify|self-review|reconcile|learn) ;; *) echo "$p";; esac
    done
)"
expect_empty 'the node status enum is stated exactly once' "$(
  n="$(grep -c 'Node status enum (only these)' "$ROUTER")"
  [ "$n" -eq 1 ] || echo "found $n definitions of the node status enum (want exactly 1)"
)"
expect_empty 'hook scripts only test statuses in the node status enum' "$(
  grep -rhoE '\.status[[:space:]]*==[[:space:]]*"[a-z]+"' "$SCRIPTS" \
  | sed 's/.*"\([a-z]*\)"$/\1/' | sort -u | while read -r s; do
      case "$s" in pending|planned|executing|executed|verified|done|killed|blocked) ;; *) echo "unknown status: $s";; esac
    done
)"
