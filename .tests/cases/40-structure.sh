#!/usr/bin/env bash
# Structural integrity: manifests parse, hooks point at real scripts, and every skill/agent/
# command has frontmatter that YAML will read the way the author intended.
#
# The frontmatter checks exist because this is the plugin's silent failure mode: a SKILL.md
# whose frontmatter does not parse loads with empty metadata — no name, no description — so
# Claude never invokes the skill and nothing reports an error.

MP="$REPO_ROOT/.claude-plugin/marketplace.json"

group 'hook scripts'
for s in gate-check.sh loop-not-closed.sh session-resume.sh; do
  ok_if "$s exists"        test -f "$SCRIPTS/$s"
  ok_if "$s parses"        bash -n "$SCRIPTS/$s"
done

# Every command in hooks.json must resolve to a script that exists once CLAUDE_PLUGIN_ROOT is
# substituted — a typo here disables a gate silently.
ok_if 'hooks.json is valid JSON' jq -e . "$PLUGIN/hooks/hooks.json"
expect_empty 'hooks.json references only existing scripts' "$(
  jqr '.hooks | to_entries[] | .value[] | .hooks[] | .command' "$PLUGIN/hooks/hooks.json" 2>/dev/null \
  | grep -oE '\$\{CLAUDE_PLUGIN_ROOT\}/[^"]+' | sed 's|${CLAUDE_PLUGIN_ROOT}/||' | sort -u \
  | while read -r rel; do [ -f "$PLUGIN/$rel" ] || echo "missing: $rel"; done
)"
expect_empty 'every hook script is wired into hooks.json' "$(
  for s in gate-check.sh loop-not-closed.sh session-resume.sh; do
    grep -q "$s" "$PLUGIN/hooks/hooks.json" || echo "orphan script: $s"
  done
)"

group 'manifests'
ok_if 'plugin.json is valid JSON'      jq -e . "$PLUGIN/.claude-plugin/plugin.json"
ok_if 'marketplace.json is valid JSON' jq -e . "$MP"
expect_eq 'plugin.json name matches its directory' 'engineering-loop' \
  "$(jq -r '.name' "$PLUGIN/.claude-plugin/plugin.json")"
ok_if 'plugin.json has a description' \
  test -n "$(jq -r '.description // empty' "$PLUGIN/.claude-plugin/plugin.json")"
expect_empty 'every marketplace source path exists' "$(
  jqr '.plugins[].source' "$MP" | while read -r src; do
    [ -d "$REPO_ROOT/${src#./}" ] || echo "missing: $src"
  done
)"
expect_empty 'every marketplace plugin name is kebab-case' "$(
  jqr '.plugins[].name' "$MP" | grep -vE '^[a-z0-9]+(-[a-z0-9]+)*$' || true
)"
expect_empty 'each marketplace entry names the plugin in its own manifest' "$(
  jqr '.plugins[] | "\(.name) \(.source)"' "$MP" | while read -r name src; do
    man="$REPO_ROOT/${src#./}/.claude-plugin/plugin.json"
    [ -f "$man" ] || { echo "no manifest for $name"; continue; }
    [ "$(jq -r '.name' "$man")" = "$name" ] || echo "name mismatch: $name"
  done
)"

# ---------------------------------------------------------------- frontmatter
#
# Keys whose value must be a plain string. A flow collection here is the documented footgun:
# `argument-hint: [a plan file, a PR number]` parses as a list, not a string. Keys outside this
# set (notably `allowed-tools`) are legitimately lists and are not flagged for that.
STRING_KEYS='name description argument-hint'

frontmatter_issues() {
  awk -v stringkeys="$STRING_KEYS" '
    BEGIN { SQ = sprintf("%c", 39); split(stringkeys, sk, " "); for (i in sk) isstr[sk[i]] = 1 }
    NR == 1 && $0 != "---" { printf "%s:1 no opening ---\n", FILENAME; bad = 1; exit }
    NR == 1 { infm = 1; next }
    infm && $0 == "---" { infm = 0; closed = 1; exit }
    infm && /^[A-Za-z_][A-Za-z0-9_-]*:/ {
      key = $0; sub(/:.*/, "", key)
      val = $0; sub(/^[A-Za-z_][A-Za-z0-9_-]*:[ \t]*/, "", val)
      if (val == "") next                                  # block scalar or nested mapping
      c = substr(val, 1, 1)
      if (c == "|" || c == ">") next                       # block scalar
      if (c == "\"" || c == SQ) next                       # quoted — the parser owns it
      if (c == "[" || c == "{") {
        if (isstr[key]) printf "%s:%d %s is a flow collection, not a string\n", FILENAME, NR, key
        next
      }
      if (index("*&#!%@`", c) > 0) { printf "%s:%d %s starts with YAML indicator %s\n", FILENAME, NR, key, c; next }
      if (val ~ /: /)  printf "%s:%d unquoted %s contains \": \"\n", FILENAME, NR, key
      else if (val ~ / #/) printf "%s:%d unquoted %s contains \" #\"\n", FILENAME, NR, key
    }
    END { if (!bad && !closed) printf "%s frontmatter never closed\n", FILENAME }
  ' "$1"
}

fm_value() { sed -n '2,/^---$/p' "$1" | grep -m1 "^$2:" | sed "s/^$2:[[:space:]]*//" | sed 's/^"//; s/"$//'; }

group 'frontmatter — skills'
expect_empty 'every SKILL.md has a parseable frontmatter block' "$(
  for f in "$PLUGIN"/skills/*/SKILL.md; do frontmatter_issues "$f"; done
)"
expect_empty 'every SKILL.md declares name and description' "$(
  for f in "$PLUGIN"/skills/*/SKILL.md; do
    [ -n "$(fm_value "$f" name)" ]        || echo "no name: ${f#$PLUGIN/}"
    [ -n "$(fm_value "$f" description)" ] || echo "no description: ${f#$PLUGIN/}"
  done
)"
expect_empty 'every SKILL.md name matches its directory' "$(
  for f in "$PLUGIN"/skills/*/SKILL.md; do
    d="$(basename "$(dirname "$f")")"; n="$(fm_value "$f" name)"
    [ "$d" = "$n" ] || echo "$d != $n"
  done
)"

group 'frontmatter — agents'
expect_empty 'every agent has a parseable frontmatter block' "$(
  for f in "$PLUGIN"/agents/*.md; do frontmatter_issues "$f"; done
)"
expect_empty 'every agent name matches its filename' "$(
  for f in "$PLUGIN"/agents/*.md; do
    b="$(basename "$f" .md)"; n="$(fm_value "$f" name)"
    [ "$b" = "$n" ] || echo "$b != ${n:-<none>}"
  done
)"
expect_empty 'every agent declares a description' "$(
  for f in "$PLUGIN"/agents/*.md; do
    grep -qE '^description:' "$f" || echo "no description: $(basename "$f")"
  done
)"

group 'frontmatter — commands'
expect_empty 'every command has a parseable frontmatter block' "$(
  for f in "$PLUGIN"/commands/*.md; do frontmatter_issues "$f"; done
)"
expect_empty 'every command declares a description' "$(
  for f in "$PLUGIN"/commands/*.md; do
    [ -n "$(fm_value "$f" description)" ] || echo "no description: $(basename "$f")"
  done
)"
expect_empty 'every command allowed-tools is valid JSON' "$(
  for f in "$PLUGIN"/commands/*.md; do
    line="$(grep -m1 '^allowed-tools:' "$f" | sed 's/^allowed-tools:[[:space:]]*//')"
    [ -z "$line" ] && continue
    printf '%s' "$line" | jq -e . >/dev/null 2>&1 || echo "unparseable in $(basename "$f")"
  done
)"

group 'claude plugin validate (authoritative frontmatter parser)'
if command -v claude >/dev/null 2>&1; then
  ok_if 'marketplace validates'                claude plugin validate "$REPO_ROOT"
  ok_if 'engineering-loop plugin validates'    claude plugin validate "$PLUGIN"
else
  skip 'marketplace validates'             'claude not on PATH'
  skip 'engineering-loop plugin validates' 'claude not on PATH'
fi
