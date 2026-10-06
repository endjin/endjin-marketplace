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
| Row above the prompt | `backlog: 4 open, » 1 in progress, ● 2 new, 1 to decide` for the current project, on the terminal and desktop, while it has open items; press `backlog:` to open or close the pane. VS Code and mobile show the counts on a plain status line instead |
| `mcp__backlog__add` | Claude records one or more items; an open item with the same title is refreshed, not duplicated |
| `mcp__backlog__update` | Claude marks an item in progress or done, re-prioritises it, or appends a note |
| `mcp__backlog__list` | Claude lists the backlog, or reads one item in full; new items are flagged `new` |

A short system-prompt section tells Claude to record what a piece of work leaves behind, to
write each item so it stands alone, to mark an item in progress when it starts work on it, and
to mark items done when it settles them.

## What is being worked on, and what is new

Two marks stand before an item's title in the pane:

| Mark | Means |
| --- | --- |
| `»` | In progress: a session is working on it. Fix now, an option, Accept recommendation and Direct set this, and so does Claude when it takes up an item itself |
| `●` | New: the item is open and was recorded in the last 10 minutes, by this session or another |

An item in progress is never also marked new. A new item loses its mark on the first five-second
poll after its 10 minutes are up. Reopening an item ends its in-progress mark, and does not make
it new again unless it was recorded in the last 10 minutes.

The pane header counts what the list shows, and its marks are the legend:
`3 open, » 1 in progress, ● 2 new, 1 to decide`. The row above the prompt gives the same counts,
with the same marks, for the current project, whatever the pane shows; VS Code and mobile have no
such row, so their status line gives the counts without the marks. The row gives way to a survey,
and is not drawn while the project has nothing open. The detail view of an item in progress says since when, and whether this
session or another one is working on it; the later session to take it up is the one shown.

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

The backlog is a folder of change records, `~/.claude/backlog/items/` (under `CLAUDE_CONFIG_DIR`
when that is set). Every session with the plugin enabled reads and writes that folder, re-reads
it every five seconds, and shows a toast when another session adds an item. When none of
`CLAUDE_CONFIG_DIR`, `USERPROFILE` and `HOME` is set, an empty value counting as unset, there is
no folder: the session logs why, and Claude's calls are refused, saying nothing was recorded.

Each change to an item is a small JSON file of its own, named `<id>.<time>.<token>.json`, that
says which fields it sets and which note it appends. A file is written once and never rewritten.
An item is its records applied in time order. So two sessions that change the same item never
overwrite each other: a note from one and a status from another both stand, and when both set
the same field the later one wins.

The pane lists the current project's items; **All projects** shows the rest. An item from
another project says so in its detail view, because acting on it runs in the session you are in,
not the one that recorded it.

Items are never deleted, only marked done or dismissed. To clear the backlog, delete the files.

Limits are enforced when Claude writes, never by cutting text short: one `add` call takes at
most 50 items, a detail at most 20,000 characters, and a note at most 10,000. A call over a
limit is refused with the reason, so Claude can split it.

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
| `types/index.d.ts` | The item and change-record shapes, and the `$.state` contract |
| `tests/backlog.test.ts` | Behaviour tests over an in-memory folder, on the terminal, desktop, VS Code and mobile surfaces |
