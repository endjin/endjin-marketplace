# backlog

A Claude Code mod: a side pane that tracks the defects, issues, follow-up tasks and decisions
your sessions turn up, so they stop scrolling away in the transcript.

Long-running sessions end every iteration with a list of things left over. This plugin gives
Claude a place to record them and gives you a pane to triage them: grouped by category, sorted
by priority, with a detail view where you decide, direct or dismiss each one.

## What you get

| Piece | What it does |
| --- | --- |
| `/backlog` | Opens and focuses the pane |
| Backlog pane | Open items grouped as Decisions, Defects, Issues and Tasks, each sorted critical to low |
| Detail view | The item's full context, Claude's recommendation, its options, and the actions below |
| Status line | `backlog: 4 open, 1 to decide` for the current project |
| `mcp__backlog__add` | Claude records one or more items; an open item with the same title is refreshed, not duplicated |
| `mcp__backlog__update` | Claude marks an item done with a resolution, re-prioritises it, or appends a note |
| `mcp__backlog__list` | Claude lists the backlog, or reads one item in full |

A short system-prompt section tells Claude to record what a piece of work leaves behind, to
write each item so it stands alone, and to mark items done when it settles them.

## Acting on an item

Open an item in the pane, then:

- **Pick an option** on a decision, or **Accept recommendation**.
- **Fix now** on a defect, issue or task.
- Type into **Direct** to tell Claude what to do about it in your own words.
- **Mark done**, **Dismiss**, **Reopen**, or change its priority.

Deciding, directing and fixing each send the item to the session whose pane you pressed the
button in, as a prompt that runs once that session is idle. The item is marked in progress, and
Claude is asked to mark it done with a one-line resolution when it finishes.

## One backlog across sessions

Each item is one JSON file in `~/.claude/backlog/items/` (under `CLAUDE_CONFIG_DIR` when that is
set). Every session with the plugin enabled reads and writes that folder, re-reads it every five
seconds, and shows a toast when another session adds an item.

The pane lists the current project's items; **All projects** shows the rest. An item from
another project says so in its detail view, because acting on it runs in the session you are in,
not the one that recorded it.

Items are never deleted, only marked done or dismissed. To clear the backlog, delete the files.

## Requirements and limits

- Claude Code with mod support (function hooks). Built and tested against 2.1.289; the API is
  early access and may change between releases.
- Claude Code only. The plugin is a hooks module (`hooks/register.tsx`), which other agents that
  read this marketplace do not run.
- The pane opens by itself at session start only in a terminal at least 144 columns wide.
  Below that, run `/backlog`.
- The detail view has no keyboard shortcuts: use Tab, Enter and the mouse.

## Developing

```bash
claude plugin validate ./plugins/backlog    # manifest, hooks and state contract
claude plugin test ./plugins/backlog        # tests/backlog.test.ts, against the engine
claude --plugin-dir ./plugins/backlog       # load it from disk, hot-reloading on save
```

Loading it with `--plugin-dir` makes the engine write its type declarations into
`.claude-plugin/types/` (ignored by git), which `tsconfig.json` extends, so an editor and
`tsc -p plugins/backlog` type-check the module.

| Path | Holds |
| --- | --- |
| `hooks/register.tsx` | The hooks module: tools, command, system-prompt section, storage and the pane |
| `types/index.d.ts` | The item's shape and the `$.state` contract |
| `tests/backlog.test.ts` | Behaviour tests over an in-memory folder, on the terminal and desktop surfaces |
