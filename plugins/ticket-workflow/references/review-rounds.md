# The review-round protocol

`plan-ticket` writes review rounds. `implement-ticket` gates on them. Both read this file, so the
marker format is a contract between two skills that never run in the same session.

The protocol lives in the ticket's comment thread because that is the one place both skills, both
humans, and any future run can see. Nothing here depends on session memory.

## The round comment

One comment per round, **edited in place** as the round progresses. Never one comment per finding,
never a reply chain.

**First line, exactly:**

```
Review round N: OPEN
```

`N` is a decimal number. No emphasis anywhere on the line, no text after the marker. The line is
matched by machine; decoration breaks it.

**Body:** a table with the columns `id | severity | finding | resolution`, one row per finding.
Resolution cells start empty.

**On close:** edit the first line to `Review round N: RESOLVED`.

A pass that finds nothing posts a comment whose first line is `Review round N: RESOLVED` and whose
body is `No findings.` Every planned ticket therefore carries at least one round comment, and an
absent round is distinguishable from a clean one.

## Round numbering, on entry

Before opening a round, list the ticket's comments and classify them:

- A comment whose first line is `Review round N: OPEN` is the **current round**. Complete it in
  place. Never open a second round while one is open.
- Otherwise the next round number is the highest existing round number plus one, or 1 if there is
  none.

## Normalising a first line

Both skills classify a comment by its **normalised** first line. Normalise identically:

1. Take the text up to the first newline.
2. Strip HTML tags and decode HTML entities.
3. Strip `*` and `_` emphasis markers.
4. Trim leading and trailing whitespace.

A tracker that stores comments as HTML will return `<div>Review round 2: RESOLVED</div>`, and a
tracker that sanitises markdown may add whitespace of its own. Normalisation absorbs both. Matching
raw text does not.

## The free-text sweep

Any comment that is not a round comment may still record an unresolved concern — a human's remark,
or a comment left by an earlier convention.

A non-round comment is **benign** when its normalised first line starts with `Resolved`, `Reviewed`,
or `Planning notes`, with any punctuation after the word. Every other non-round comment is a
**potential block**.

`plan-ticket` carries each potential block into the current round's table as a finding and resolves
it there. `implement-ticket` refuses on any potential block that is newer than the newest round
comment, and quotes the offending first lines.

No unresolved concern may live outside the round tables. That is what makes a first-line scan a
sufficient gate.

## Resolving a finding

Fill the row's resolution cell by editing the round comment:

- **Valid finding** — change the plan, then write what changed into the cell.
- **Cannot resolve** — the finding needs a product or architecture decision, is blocked on another
  team, or is genuinely out of scope. Write `OPEN — reason` into the cell and apply the config's
  **Blocking marker** to the ticket.

A round closes when every cell is filled and none starts `OPEN`.

## The implement gate

`implement-ticket` proceeds only when all of these hold:

- The ticket does not carry the **Blocking marker**.
- Every `Review round` first line ends `: RESOLVED`.
- No potential block is newer than the newest round comment.
- **Where the ticket carries no round comment at all**, every non-round comment is benign. A ticket
  planned before this convention, or planned by hand, has no round to gate on, so the whole thread
  is classified by the benign test above. Absence of rounds is not, by itself, a refusal.
- The plan location contains an `## Implementation plan` section.
- Every child spike or decision ticket is resolved.
- Every decision record the plan depends on is merged.

The gate fails closed. An unrecognised first line refuses rather than passes.

## Unblocking a stuck round

Whoever makes the call records it by editing the round comment: fill the `OPEN` cell, flip the
first line to `Review round N: RESOLVED`, and remove the blocking marker. Re-running `plan-ticket`
is the safer route — it adopts the open round under the entry rule above and keeps every marker
machine-clean.

## When comment editing is unsupported

Some trackers cannot edit a comment after posting. The config declares this as
**Comment editing: unsupported**. The protocol then changes in exactly one way:

Instead of editing the round comment, post a **replacement** comment carrying the full, current
round table and the same `Review round N: …` first line. The newest comment bearing a given round
number is that round's state; older ones are superseded. Both skills read rounds newest-first under
this mode, and the free-text sweep ignores superseded round comments.

Everything else — numbering, normalisation, the sweep, the gate — is unchanged.
