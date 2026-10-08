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
| Row above the prompt | `backlog: 4 open, » 1 in progress, ● 2 new, 1 to decide` for the current project, on the terminal and desktop, while it has open items; press `backlog:` to open or close the pane. VS Code and mobile show the counts on a plain status line instead, also when they attach to a terminal session |
| Ids in Claude's replies | On the desktop and in the fullscreen terminal, an item's id is a link that opens the pane on that item |
| `mcp__backlog__add` | Claude records one or more items; an open item with the same title is refreshed, not duplicated: it takes the category, priority, detail, options and recommendation given, so a defect recorded again as a decision becomes one, and the reply says it moved |
| `mcp__backlog__update` | Claude marks an item in progress or done, re-prioritises it, or appends a note |
| `mcp__backlog__list` | Claude lists the backlog, or reads one item in full; new items are flagged `new`, and an item in progress for a day or more says for how long |

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
and is not drawn while the project has nothing open.

A session can draw on several surfaces at once. The status line is set while any of them has no
row, so a phone or VS Code that attaches to a terminal session gets the counts as well, until the
last such surface leaves. One status line serves the whole session, so while one is attached the
terminal shows the counts twice: in its row and on its status line.

The detail view of an item in progress says since when, and whether this session or another one
is working on it; the later session to take it up is the one shown.

## When work on an item stops

An item in progress goes back to open in three ways, so a `»` does not outlive the work:

- **The session ends.** A session that exits, is cleared or is replaced by a resumed one gives
  back every item it has in progress, each with the note
  `Released: the session working on it ended.` Items another session has since taken up are left
  alone.
- **Claude stops.** Claude is told to set an item back to open, with a note saying what is left,
  when it stops work on it without finishing.
- **You release it.** A session that crashes writes nothing, so its items stay in progress. An
  item in progress for a day or more says so: `3d` before its title in the list,
  `In progress since 2026-10-03 (3 days)` in its detail view, and `in progress for 3 days` when
  Claude lists the backlog. **Release** in the detail view sets it back to open. The age moves on
  the first five-second poll past each whole day.

## Acting on an item

Open an item in the pane, then:

- **Pick an option** on a decision, or **Accept recommendation**.
- **Fix now** on a defect, issue or task.
- Type into **Direct** to tell Claude what to do about it in your own words.
- **Mark done**, **Dismiss**, **Reopen**, or change its priority.
- **Release** an item in progress, to set it back to open.

Deciding, directing and fixing each send the item to the session whose pane you pressed the
button in, as a prompt that runs once that session is idle. The item is marked in progress, and
Claude is asked to mark it done with a one-line resolution when it finishes, or to set it back to
open with a note when it cannot.

An action the backlog folder does not take, because it cannot be read or written, changes
nothing and says why in a toast; press it again once the folder is back. When an item was sent to
Claude but could not be marked in progress, the toast says that instead.

## Ids in the transcript

Claude's replies name items by id, such as `iqzyou3r`. On the desktop and in the fullscreen
terminal, the id of every item on the backlog, in any project and open or closed, is a link:
click it to open the pane on that item. On the terminal's main screen, and in VS Code and on
mobile, ids stay plain text: a click there would open a browser, not the pane. An id inside
a code block or a code span, or inside a link Claude already wrote, is left as it is. An item that
has left the backlog since the reply was drawn says so in a toast.

## One backlog across sessions

The backlog is a folder of change records, `~/.claude/backlog/items/` (under `CLAUDE_CONFIG_DIR`
when that is set). Every session with the plugin enabled reads and writes that folder, re-reads
it every five seconds, and shows a toast when another session adds an item. When none of
`CLAUDE_CONFIG_DIR`, `USERPROFILE` and `HOME` is set, an empty value counting as unset, there is
no folder: the session logs why, and Claude's calls are refused, saying nothing was recorded.
The same refusal answers a call when the folder cannot be read or written. An `add` of several
items that fails part way through is refused differently: it lists the items recorded before the
failure and names the ones to send again.

Each change to an item is a small JSON file of its own, named `<id>.<time>.<token>.json`, that
says which fields it sets and which note it appends. A file is written once and never rewritten.
An item is its records applied in time order. So two sessions that change the same item never
overwrite each other: a note from one and a status from another both stand, and when both set
the same field the later one wins.

The pane lists the current project's items; **All projects** shows the rest. An item from
another project says so in its detail view, because acting on it runs in the session you are in,
not the one that recorded it.

Items are never deleted, only marked done or dismissed. To clear the backlog, delete the files.

Most limits are enforced when Claude writes, by refusing with the reason, so Claude can shorten
or split what it sent:

| Limit | Over it |
| --- | --- |
| 50 items in one `add` call | The call is refused whole |
| Title: 200 characters, counted with its whitespace collapsed | `add` skips that item and records the rest; `update` is refused |
| Options: nine with a label | `add` skips that item and records the rest |
| Detail: 20,000 characters | `add` skips that item and records the rest |
| Note: 10,000 characters | `update` is refused |

Four shorter fields are cut to their limit instead, without a message: an option's label at 120
characters, an option's detail at 1,000, and a recommendation and a resolution at 2,000 each.

A resolution the pane writes, `Accepted the recommendation: ...` or `Directed: ...`, is kept
whole up to that 2,000, and ends with an ellipsis when it is cut. The direction itself reaches
Claude whole.

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
| `hooks/register.tsx` | The hooks module: tools, command, system-prompt section, storage, the pane and the links to items in replies |
| `types/index.d.ts` | The item and change-record shapes, and the `$.state` contract |
| `tests/backlog.test.ts` | Behaviour tests over an in-memory folder, on the terminal, desktop, VS Code and mobile surfaces |
