# Ticket Workflow

Two skills that take a ticket from "someone wrote a sentence in the backlog" to a pull request that
has survived review, and one that sets them up.

The workflow is the same everywhere. The facts are not: your tickets live in a different system from
mine, your plan goes in a different field, your definition of green is a different set of commands.
So the skills carry the protocol, and **one configuration file in your repository carries the
facts**.

## The skills

| Skill | What it does |
| --- | --- |
| `ticket-workflow-init` | Inspects the repository, asks about what it cannot detect, and writes the configuration file. |
| `plan-ticket` | Refines the problem statement and acceptance criteria, writes an implementation plan onto the ticket, then attacks that plan with a fresh subagent until nothing significant is left. Splits a ticket that holds more than one deliverable, raises a decision record where one is warranted, and tracks each spike as a child ticket. |
| `implement-ticket` | Checks the ticket is genuinely ready, branches, implements the plan, keeps every commit green and linted, opens a draft pull request early, meets the definition of done, then runs the review loop to closure. |

The two halves talk to each other through the ticket, not through a session. `plan-ticket` records
its review rounds as comments in a defined format; `implement-ticket` gates on those comments and
**fails closed**. Anyone can run either half, weeks apart, in a fresh context.

## Setup

```shell
/plugin marketplace add endjin/endjin-marketplace
/plugin install ticket-workflow@endjin
/reload-plugins
```

Then, in the repository you want to use it in:

```
/ticket-workflow:ticket-workflow-init
```

It writes `.claude/ticket-workflow.md`. Read what it wrote — it will have detected most of it, asked
you about the rest, and flagged anything left as a placeholder.

Then:

```
/ticket-workflow:plan-ticket 229460
/ticket-workflow:implement-ticket 229460
```

## The configuration file

One markdown file, prose rather than JSON, because half of what the workflow needs to know is
nuance that no schema survives. Section headings and bold keys are the contract; everything else is
free text that informs the model.

It records:

- **Tracker** — the system, how to reach it, where the plan and the acceptance criteria live, how
  comments behave, what marks a ticket as blocked, how a child ticket is created.
- **Source control** — base branch, branch naming, commit conventions, worktrees.
- **Pull requests** — how one is created, whether drafts exist, whether a ticket link is required.
- **Quality gates** — the lint and test commands, and the traps that make a suite lie.
- **Code review** — who reviews, what to do when they are unavailable, what only a human may launch.
- **Writing style** — the file that governs ticket prose, and the file that governs documentation.
- **Project conventions** — context files, decision records, documentation, post-PR steps.

Full schema: [`references/config-schema.md`](references/config-schema.md). Blank template:
[`templates/ticket-workflow.md`](templates/ticket-workflow.md). Worked examples for
[Azure DevOps](examples/azure-devops.md) and [GitHub](examples/github.md).

Check yours at any time, from the repository root:

```bash
python3 <plugin-root>/scripts/check-config.py
```

It reports missing sections, unanswered keys and dangling file paths. `ticket-workflow-init` runs
it for you before it hands back.

## Trackers

`references/trackers/` carries a file per tracker the plugin knows in detail — currently
[Azure DevOps](references/trackers/azure-devops.md) and [GitHub](references/trackers/github.md).
Each records the behaviour that costs a run if you learn it the hard way: which fetch hides the
field format, which sanitiser eats angle brackets, which thread resolution has no REST route.

Any other tracker works from the configuration alone. Write the **Access**, **Comment format** and
**Comment editing** keys in more detail there, and consider contributing an adapter file.

## Design notes

**Nothing depends on session memory.** Every gate reads the ticket thread or the repository, so an
interrupted run resumes correctly and a second agent reaches the same verdict.

**The gates fail closed.** An unrecognised comment marker refuses. An unresolved child ticket
refuses. A plan whose decision record has not merged refuses. Every refusal names what blocked it
and how to unblock it.

**The plan gets compacted before implementation.** A plan that argued with itself for four rounds is
not the plan the implementer should read. The final pass rewrites it from scratch for someone who
was not in the room, keeps every constraint that changes what they do, dates every empirical claim,
and moves the provenance to a comment.

**A long compacted plan is a signal, not a formatting problem.** It means the ticket holds more than
one deliverable, and the skill proposes a split rather than compressing harder.

## Notes

- Skills are namespaced: `/ticket-workflow:plan-ticket`. If your repository already has its own
  `plan-ticket` command, the bare name resolves to yours — use the namespaced form to be explicit.
- The skills read your existing `CLAUDE.md`, `AGENTS.md` and rules files rather than duplicating
  them. Point at those files from the configuration; do not copy their content into it.
- Nothing here is Claude Code-specific. The skills are plain
  [Agent Skills](https://github.blog/changelog/2025-12-18-github-copilot-now-supports-agent-skills/),
  so they work from GitHub Copilot CLI and any other tool that reads `SKILL.md`.
