---
name: implement-ticket
description: Implement a ticket from the plan recorded on it, through to a reviewed pull request. Use when asked to implement, build, do, or pick up a ticket, issue, work item, story or bug — "implement 229460", "build issue 812", "pick up PROJ-77". Checks the ticket is actually ready first, then branches, implements, tests, verifies, opens the pull request and runs the review loop to closure. Works with any tracker through a per-repository configuration file.
---

# Implement a ticket

You are implementing a ticket that has already been planned, and taking it to a pull request that
has survived review.

The plan on the ticket is the specification. Where it is silent, the repository's conventions
decide. Where both are silent, ask.

Paths below starting `references/` are relative to this plugin's root (`${CLAUDE_PLUGIN_ROOT}`, two
directories above this file).

## 0. Load the configuration

Read the repository's ticket-workflow configuration. Search this order and use the first that
exists:

1. `.claude/ticket-workflow.md`
2. `.github/ticket-workflow.md`
3. `.agents/ticket-workflow.md`
4. `ticket-workflow.md`

**If none exists, stop.** Tell the user, and offer to run the `ticket-workflow-init` skill.

Then read `references/trackers/<System>.md` if one matches the config's **System**, and
`references/review-rounds.md`, which defines the gate in step 1. Read the config's **Writing style →
Ticket and PR register** and every file it names, and the **Project conventions → Context files**.

**Arguments.** The request names the ticket id, or several. It may also ask for an **isolated
worktree** — use one for risky changes, or to run several implementations in parallel, following the
config's **Source control → Worktrees** conventions. If no id was given, ask which ticket to
implement.

## 1. Precondition check — staged, cheapest first

Run the stages in order, **per ticket**. Refuse at the first failure: stop and tell the user, and do
not start coding. Do not fetch the whole ticket until the cheap stages pass.

**Stage 1a — status and markers.** Fetch only the status field and the config's **Blocking marker**
field. Batch the call across ids where the tracker supports it. Match markers as exact tokens, never
by substring — a substring match on a tag or label name eventually finds the wrong thing. **Refuse**
if the blocking marker is present.

**Stage 1b — the review-comment gate.** List the ticket's comments and classify each by its
**normalised first line**, exactly as `references/review-rounds.md` defines normalisation. Apply
that reference's implement gate. It **fails closed**: an unrecognised first line refuses rather than
passes. Quote the offending first lines, truncated, so the user can judge them at a glance.

**Stage 2 — the plan.** Only once 1a and 1b pass, fetch the full ticket, including its child links,
and the status of each child. Follow the adapter's advice on doing that in as few calls as the API
allows. Read the plan from the config's **Plan location**, honouring any per-type exception.

**Refuse** if:

- the plan location has no `## Implementation plan` section, in whichever format the field holds;
- the plan references an architecture decision record that has not yet merged into the base branch;
- any child spike or decision ticket is unresolved.

**A refusal message names what blocked it and how to unblock it**: run the `plan-ticket` skill, or
record the decision by editing the round comment — fill the open resolution cell, flip the header to
`Review round N: RESOLVED`, and remove the blocking marker.

Reading the full comment thread beyond first-line classification is a deliberate act for when the
plan is ambiguous. It is not default intake.

Otherwise, continue.

## 2. Branch and implement

1. **Create a feature branch** from the config's **Base branch**, named to its **Branch naming**
   pattern. Never work directly on the base branch. Follow the config's **Rebase policy** — in
   particular, do not rebase a shared branch.

   If an isolated worktree was requested, create the branch in one, per the config's **Worktrees**
   conventions. Those conventions exist because worktrees break in repository-specific ways: a
   dependency install that does not carry across, a service that may only run once at a time, a
   path that must sit on a particular volume. Read them before you create it, not after.

2. **Implement according to the `## Implementation plan`.** Respect the **Context files**, any
   path-scoped rules covering the files you touch, and the relevant architecture decision records.

3. **Commit granularly, and never commit red or unlinted code.** Before **every** commit, the code
   passes the config's **Quality gates → Lint and format** commands, and the tests covering what you
   changed are green. Split anything beyond a trivial change into several commits, and push after
   each. Where several tickets are named, make at minimum one commit per ticket. Follow the config's
   **Commit conventions**, including any required trailer.

4. **Open a draft pull request after the first commit and push**, where the config's **Draft
   support** allows it, so progress is visible early. Link the ticket per **Linked work item**.

5. **Tests are part of implementation, not an afterthought.** Write and extend the suites the plan
   calls for, named per the config's **Tests**.

## 3. Definition of done, before requesting review

Do not flip the pull request to ready until **all** of these hold:

- Every **Lint and format** command passes.
- Every suite under **Tests** is green. Honour the **Test traps** key: a suite that needs a flag, a
  running service, or a sign-in will otherwise report success having run nothing.
- Any user-visible change is confirmed in the running application, by the config's **Manual
  verification** method.
- Every gate under **Additional gates** is met — documentation the plan requires, context files
  updated where the change alters how the repository is built, run or tested. Read the config's
  **Writing style → Documentation register** before authoring any new document.

Write the pull-request description and every ticket and pull-request comment in the register named
by **Ticket and PR register**. Respect the **Description limits**, and put any overflow where that
key says it goes.

When all hold, push and **flip the draft to ready**, or create the pull request if none exists yet.

## 4. Code-review loop

Repeat until a pass finds no further significant issue. Minor nits may remain — the bar is "nothing
meaningful left", not literally zero comments.

1. **Review.** Invoke the config's **Code review → Reviewer** over the pull request's changes, with
   the arguments that key specifies, and capture the findings. If it is unavailable, use the
   **Fallback** — by default, an adversarial subagent over the diff between the base branch and
   `HEAD`. Never launch anything the **Escalation** key marks as human-triggered; suggest it
   instead.

   Many review tools assume GitHub. On another host, pass the pull-request id, repository and branch
   explicitly, and tell the tool which access mechanism to use instead.

2. **Record.** Post each finding per the config's **Finding disposition** — as an inline thread
   against the relevant file and line where the host supports it.

3. **Address each finding.** Apply the fix, push it, reply to the thread explaining the fix, and
   resolve the thread. A false positive or a won't-fix gets a reply carrying the justification and
   is resolved as such. Never leave a finding silently unanswered.

4. **Re-review.** Once every finding from this pass is addressed and pushed, run the review again.
   Stop when a pass surfaces nothing significant.

## 5. Post-pull-request steps

Run whatever the config's **Post-PR steps** key lists — a diff explanation, a deployment, a
notification.

**Where a step is marked ready-only, gate on the real state.** Fetch the pull request and read its
draft flag rather than trusting what you did earlier in the session. If it is still a draft, skip
those steps and say so, with the reason, in the wrap-up.

Where a step names a skill or command that owns its own conventions, invoke it and let it read
those conventions. Do not restate them here or apply them yourself — the owning rule is their only
source, and it grows.

## 6. Wrap up

Report: the pull-request link and whether it is ready or draft, the test results, what was verified
in the running application, how many review rounds it took, the outcome of each post-PR step or why
it was skipped, and any thread left open with its justification.
