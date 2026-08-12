---
name: plan-ticket
description: Refine a ticket and produce an implementation plan that survives adversarial review, written back to the ticket itself. Use when asked to plan, refine, groom, or work up a ticket, issue, work item, story, bug or backlog item before implementation starts — "plan 229460", "refine this issue", "write an implementation plan for PROJ-812". Works with any tracker (Azure DevOps, GitHub Issues, Jira, Linear) through a per-repository configuration file.
---

# Plan a ticket

You are producing an implementation plan for a ticket, and writing it back to the ticket so that
whoever implements it — a person or a later agent session — needs nothing else.

The plan is finished when an adversarial review pass cannot find a significant hole in it.

Paths below starting `references/`, `templates/` or `examples/` are relative to this plugin's root
(`${CLAUDE_PLUGIN_ROOT}`, two directories above this file).

## 0. Load the configuration

Read the repository's ticket-workflow configuration. Search this order and use the first that
exists:

1. `.claude/ticket-workflow.md`
2. `.github/ticket-workflow.md`
3. `.agents/ticket-workflow.md`
4. `ticket-workflow.md`

**If none exists, stop.** Tell the user, and offer to run the `ticket-workflow-init` skill, which
inspects the repository and writes the file. Do not infer the tracker from the git remote and press
on — a plan written into the wrong field is worse than no plan.

Then:

- Read `references/trackers/<System>.md` if a file matches the config's **System** value. It carries
  the traps that adapter is known for.
- Read `references/review-rounds.md`. It defines the round markers, and `implement-ticket` gates on
  exactly what you write.
- Read the config's **Writing style → Ticket and PR register**, and every file it names. It governs
  the plan, the refined problem statement, the acceptance criteria, and every review comment you
  write.
- Read the config's **Project conventions → Context files**.

The ticket id comes from the user's request. **If no id was given, ask which ticket to plan before
doing anything else.**

Throughout, the config's **Tracker → Access** names the operations to use for reading a ticket,
updating it, and listing, adding and editing comments. The config's **Plan location** and
**Acceptance criteria location** say which field or body section each belongs in — including any
per-type exception, which is a common source of a plan written where nobody will look for it. Where
the acceptance criteria have a location of their own, refine them there and **never duplicate them
into the plan location**.

## 1. Refine the problem statement and acceptance criteria

1. Fetch the ticket. Read the problem statement and the acceptance criteria from the locations the
   config names.
2. Judge whether they are complete enough to plan against: the problem, the expected behaviour and
   the done-conditions are each unambiguous.
3. **If they are missing or incomplete, do not guess.** Ask the user the specific questions that
   fill the gaps, using a structured question tool where the answer is a choice. Write the refined
   text back to the locations it belongs in.
4. **If the ticket is too large to implement as one unit** — it spans unrelated areas, or its
   acceptance criteria describe several independent deliverables — propose a split. With the user's
   agreement, create the child or sibling tickets using the config's **Child items** mechanism,
   carry the relevant criteria onto each, and continue planning the original or the agreed primary
   child.

Do not proceed until the ticket has a clear problem statement and clear acceptance criteria.

## 2. Produce the implementation plan

Explore the codebase as far as the change requires. Respect the **Context files**, and check the
config's **Architecture decisions** location for existing decisions that touch the affected areas.

A plan worth the name states:

- the actual files, types and components to change;
- the impact on each part of the system the change reaches;
- the tests to add or extend, named per suite from the config's **Quality gates → Tests**;
- data, migration and backwards-compatibility concerns;
- the ordering dependencies between steps;
- the risks, and what makes each one fail loudly rather than silently.

Write the plan into the **Plan location** under an `## Implementation plan` heading, after the
existing content. If the heading already exists from an earlier run, **update that section in
place** — a second heading breaks step 5's precheck. Until step 5, touch only the plan section; the
rest of the ticket body stays as it is.

Match the field's format. Where the config's **Body format** says the format is discovered per
field, discover it before writing, and follow the adapter's rules for that format.

## 3. Decisions, records and follow-up work

While planning, decide whether the work needs either of these, and handle it now rather than
discovering it mid-implementation.

**A. A significant architectural decision.** Adopting a new dependency, a new pattern, or a new
technology warrants a decision record — if the config's **Architecture decisions** key names a
location and convention.

Follow that convention exactly: the file name, the header fields, and the sections it prescribes.
Read the config's **Writing style → Documentation register** before drafting, since a path-scoped
rule fires when a file is read and not when one is written — authoring a new file will not trigger
it on its own.

A decision record is reviewed and merged **ahead of, and separately from, the implementation**. Put
it on its own branch, open a pull request linked to the ticket, reference the record from the plan,
and state in the plan that implementation is blocked until it merges.

**B. A spike, a verification step, or a decision only a human can make.** State each one explicitly
in the plan rather than burying it in a paragraph. Where the config's **Child items** mechanism
supports it, create a child ticket for each so it is tracked and closed before implementation
starts. Where it does not, list them in the plan under a heading that names them as blocking.

Note in the plan that implementation is blocked until these children and any decision record are
resolved. `implement-ticket` checks both.

## 4. Adversarial review loop

Each round is **one comment, edited in place**. Never one comment per finding, never a reply chain.
`references/review-rounds.md` is the full contract — the marker format, the normalisation rules,
and the fallback when the tracker cannot edit a comment.

**On entry**, list the ticket's comments and apply the entry rules from that reference: adopt an
open round if one exists, otherwise take the next number. Reuse an existing planning-notes comment
by editing it; never add a second. Sweep the free-text comments, and carry every potential block
into the current round's table as a finding.

Then repeat until a pass finds no further significant issue. Minor nits may remain — the bar is
"nothing meaningful left", not literally zero comments.

1. **Review.** Launch a subagent with an explicitly adversarial brief: try to break this plan. Have
   it hunt for acceptance criteria the plan does not cover, wrong or oversimplified assumptions
   about the files and the architecture, untested edge cases, missing data and migration concerns,
   and anything that would fail in review or in implementation. Add the concerns this repository is
   known for, from the **Context files** and the decision records. A fresh subagent keeps the
   critique from anchoring on the plan's own reasoning.

   Include in the brief: does the plan miss an architectural decision that warrants a record, or a
   spike or decision that should be a tracked child ticket?

2. **Record the round as one comment**, per the reference's format.

3. **Resolve by editing that comment in place.** A valid finding changes the plan, and the
   resolution cell says what changed. A finding you cannot resolve gets `OPEN — reason`, and the
   ticket gets the config's **Blocking marker**.

4. **Close the round** by flipping its first line to `Review round N: RESOLVED`. If any cell stays
   open, the header stays open, and planning ends at step 6 reporting the block.

5. **Re-review.** Once every finding is resolved, run the review again. Stop when a pass surfaces
   nothing significant.

## 5. Compact the plan

When the loop ends clean, rewrite the plan for an implementer who was not in the room.

**Gate on the thread, not on session memory.** Re-list the comments and re-run step 4's sweep. A
free-text comment that landed mid-loop becomes a new round's finding and is handled with step 4's
mechanics. Compact only when the sweep finds nothing new, every round line ends `: RESOLVED`, and
the ticket does not carry the blocking marker. Otherwise skip compaction, leave the plan full, and
say so in step 6.

**Precheck:** the `## Implementation plan` heading occurs exactly once, and the field format is
determinate. A missing heading, a duplicated heading, or an indeterminate format means stop and
report — do not compact.

**Rewrite from scratch**, from the heading to the end of the plan section. A fresh draft, not an
edit pass. Never touch anything above the heading.

- **Keep** the files and types to change, the ordering, the required tests, and every constraint
  that changes what the implementer does: traps that fail silently, ordering dependencies, real
  deadlines.
- **Cut** rejected alternatives, planning-time measurements, corrections to earlier drafts, and
  anything a later round superseded.
- **Date every retained empirical claim** — `Verified YYYY-MM-DD: …`. An undated claim gets trusted
  long after it stops being true.
- **Move provenance worth keeping** into a single planning-notes comment. Create it, or edit the
  existing one in place.

**After rewriting**, re-read the round tables and step 3's outputs. Every accepted resolution that
changes what the implementer does, every decision-record reference, and every blocked-until note
must still appear in the fresh draft.

A compacted plan that is still long is telling you the ticket holds more than one deliverable.
Propose a split, using step 1's mechanism, rather than compacting harder.

## 6. Wrap up

Report: the final state of the ticket, how many review rounds it took, any round left open with the
blocking marker, whether compaction ran, whether the ticket was split, any decision-record pull
request opened, and any child tickets created that must be resolved before implementation.
