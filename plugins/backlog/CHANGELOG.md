# Changelog

All notable changes to the backlog plugin are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

The first release of the plugin. The entries under Fixed are defects found and
fixed in review before the release, kept here so the review record stands.

### Added

- A backlog pane, opened with `/backlog`, that lists the defects, issues, tasks
  and decisions sessions turn up, grouped as Decisions, Defects, Issues and
  Tasks and sorted critical to low. Each heading folds its section to the
  heading and count, and the choice is kept across sessions.
- A detail view with the item's full context, Claude's recommendation and its
  options, where you pick an option, accept the recommendation, direct the
  work, fix it now, change its priority, mark it done, dismiss, reopen or
  release it. Acting on an item sends it to the session as a prompt.
- Three tools for Claude: `mcp__backlog__add` records one or more items and
  refreshes an open item with the same title instead of duplicating it;
  `mcp__backlog__update` changes an item's status, priority, category or
  title, sets a resolution or appends a note; `mcp__backlog__list` lists the
  backlog or reads one item in full.
- Several items in one `mcp__backlog__update` call, as `items`: the folder is
  listed once, one record is written per item, the pane is redrawn once, and
  each entry is answered in the order given.
- A system-prompt section that tells Claude to record what a piece of work
  leaves behind, to write each item so it stands alone, to mark an item in
  progress when it takes it up, done when it settles it, and open again with
  a note when it stops work unfinished.
- Marks for what is being worked on and what is new: `»` for an item in
  progress, with a line in its detail view saying which session holds it, and
  `●` for an open item recorded in the last ten minutes. A claim held for a
  day or more shows its age.
- A row above the prompt on the terminal and desktop with the current
  project's counts, `backlog: 4 open, » 1 in progress, ● 2 new, 1 to decide`;
  pressing `backlog:` opens or closes the pane. VS Code and mobile show the
  counts on the status line, including when they attach to a terminal
  session.
- Item ids in Claude's replies drawn as links that open the pane on the item,
  on the desktop and in the fullscreen terminal.
- Append-only storage under `~/.claude/backlog/items/`, shared by every
  session: each change is a file of its own, an item is its records folded in
  time order, and two sessions can change one item without a lock. Items kept
  in the earlier one-file format are still read.
- Compaction of closed items: an item at rest for an hour has its records
  folded into one file and the rest removed, three items a poll, with the
  removal retried ten minutes after a refusal.
- Fewer folder listings while idle: after twelve polls that find nothing new,
  the folder is listed every thirty seconds until something changes or a
  prompt is sent.
- A session that ends sets the items it had in progress back to open, each
  with a note; a Release button on an item in progress does the same by hand.
- Limits enforced by refusing with the reason rather than cutting text: 50
  items a call, a 200-character title, nine options, 20,000 characters of
  detail and 10,000 of a note. `add` skips an item over a limit and records
  the rest; a batch `update` does the same.
- Failure reporting on every write: a batch whose write fails part way says
  what was recorded and what to send again, and a pane action the folder
  refuses says why in a toast and leaves the item as it was.

### Fixed

- Tool calls that waited in the plugin's queue behind a slow folder listing
  outran their budget, were answered as not in time, then ran anyway and had
  the host end the plugin as a runaway. A call given up by the host is no
  longer run, and a call that queued behind a listing reuses it instead of
  listing again.
- A session rooted at `/` was recorded with an empty project, and one at
  `C:\` with `C:`. A filesystem root keeps its separator and is named as
  itself.
- A refresh of an item recorded again under the same title could restore a
  status or resolution another session had since changed.
- Two sessions could mint the same item id; ids are now eight random
  characters checked against the folder as re-read before minting.
- Inner whitespace in a project path was collapsed, so `/work/my  app` and
  `/work/my app` were one project.
- An item was marked in progress before its prompt had entered the session,
  so a dropped or rejected prompt still showed "Sent to Claude".
- A note appended past the detail limit was cut on the next read while the
  update reported success.
- The detail view hid everything past 9,000 characters, including later
  notes.
- A resumed session whose start-up state was gone showed an empty backlog
  though every record was on disk.
- With no home directory set, or an empty `USERPROFILE`, records were written
  under the filesystem root.
- A code block longer than one drawn piece was split with unbalanced fences.
- A change record with a time of null, an empty string, an empty list or a
  boolean was accepted and sorted before every real record.
- The counts went to a surface chosen once at session start, so a phone or
  VS Code attached later showed nothing.
- `mcp__backlog__add` given the title of an open item refreshed everything
  but its category, so a defect recorded again as a decision stayed a defect.
- Resolutions the pane writes, `Accepted the recommendation: ...` and
  `Directed: ...`, were cut at 200 characters; they are kept whole up to
  2,000.
- The hook on Claude's replies read state on nearly every streaming flush and
  subscribed every transcript row to it, so each item added redrew every
  reply; it now screens blocks against a local mirror of known ids.
- A reload into a version with folded sections threw on a view an earlier
  version wrote, leaving the pane blank until the next reload.

[Unreleased]: https://github.com/endjin/endjin-marketplace/pull/7
