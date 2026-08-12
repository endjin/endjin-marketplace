---
name: ticket-workflow-init
description: Write or update the per-repository ticket-workflow configuration that the plan-ticket and implement-ticket skills read. Use when setting up the ticket workflow in a repository for the first time, when those skills report that no configuration exists, or when the workflow needs to change — a different tracker, new test commands, a new review step. Detects what it can from the repository and asks only about the rest.
---

# Set up the ticket workflow

You are writing one file: the configuration that `plan-ticket` and `implement-ticket` read before
they do anything. It records where this repository's tickets live, what "done" means here, and who
reviews.

Detect everything you can. Ask about the rest. Never invent a value — a guessed field name sends a
plan somewhere nobody will look, and the failure is silent.

Paths below starting `references/` or `templates/` are relative to this plugin's root
(`${CLAUDE_PLUGIN_ROOT}`, two directories above this file).

## 1. Read the schema

Read `references/config-schema.md`. It lists every section, every key, and which answers count as
decisions rather than gaps. It is the contract the other two skills read against.

## 2. Check for an existing configuration

Search, in order: `.claude/ticket-workflow.md`, `.github/ticket-workflow.md`,
`.agents/ticket-workflow.md`, `ticket-workflow.md`.

**If one exists**, you are updating, not creating. Read it, and treat every key it already answers
as settled unless the user asks to change it or your detection contradicts it. Report contradictions
rather than overwriting them — a stale-looking value is sometimes a deliberate one.

## 3. Detect

Work through the repository. Each of these is cheap and answers a key outright:

**Tracker and host.** `git remote -v` distinguishes an Azure DevOps remote (`dev.azure.com`,
`*.visualstudio.com`) from GitHub, GitLab or another host, and carries the organisation, project and
repository names in the URL. A GitHub remote does not prove the tracker is GitHub Issues — many
teams keep code on GitHub and tickets in Jira or Linear. Confirm the tracker rather than inferring
it from the remote.

**Access.** Which MCP servers are connected, and which CLIs are installed and authenticated —
`gh auth status`, `az account show`, `jira`, `linear`. Name the specific operations in the config,
not just the tool.

**Base branch.** `git symbolic-ref refs/remotes/origin/HEAD` gives the default branch. A repository
with a long-lived integration branch will contradict it — check the context files and the recent
merge commits before settling on a value.

**Branch naming and commit conventions.** `git log --format='%s%n%b' -50` and
`git branch -r --sort=-committerdate | head -30` show the house style, including any commit trailer
in use.

**Context files.** `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, `.claude/rules/`, `.github/copilot-instructions.md`.
Read the ones that exist. They usually answer the quality-gate and convention sections outright, and
they are where a repository states the things it has learned the hard way.

**Quality gates.** Read the manifests rather than guessing scripts: `package.json` scripts, a `.sln`
or `.csproj` layout, `pyproject.toml`, `Makefile`, `justfile`, the CI workflow definitions under
`.github/workflows/` or `.azurepipelines/`. **The CI definition is the most reliable source** — it
lists the commands that actually gate a merge.

**Architecture decisions and documentation.** Look for `docs/architecture/adr/`, `docs/adr/`, `adr/`,
`docs/decisions/`. Read one existing record to capture the naming pattern and header fields, and
note any constraint on file naming — a `docs/` folder published as a wiki imposes rules that break
pages silently.

**Review and post-PR tooling.** Which review skills, commands or plugins this repository already
uses. Check the context files and `.claude/` for what the team invokes today.

## 4. Ask about the gaps

Use a structured question tool, one question per genuinely open decision. Offer the detected value
as the first option, marked as detected, so confirming is one keystroke.

Ask about these where detection was inconclusive — they are the ones that silently corrupt a run:

- **Which tracker**, when the remote does not settle it.
- **Plan location and acceptance criteria location**, when the tracker has more than one candidate
  field, or the ticket types differ.
- **Comment editing support**, which decides the review-round fallback.
- **The blocking marker** — the tag, label or state meaning *a human must decide*. Where none
  exists, agree on one and note that it must be created before first use.
- **Test traps** — ask directly: is there a suite that passes without running, or that needs a flag,
  a running service or a sign-in? This one is rarely written down and always expensive.
- **Manual verification** — how a user-visible change is confirmed in the running application.

Do not ask about anything you detected unambiguously. A setup interview that re-asks what is in the
CI definition trains the user to click through it.

## 5. Write the file

Copy `templates/ticket-workflow.md` and fill it in. Default the location to `.claude/ticket-workflow.md`
unless the repository's tooling makes another of the search paths the natural home.

- **Keep the `##` headings and the bold keys exactly as the template has them.** The other skills
  locate values by heading and bold key.
- **Answer every key.** `None`, `Not used` or `Not applicable` are answers; a missing key reads as
  unknown and stops a run.
- **Write the nuance.** The keys that pay for themselves are **Test traps**, **Comment format** and
  **Worktrees**, because each records something that fails quietly. Copy the specifics from the
  context files rather than paraphrasing them into vagueness.
- **Point at files, do not copy them.** For the writing registers and the context files, name the
  path. A copied rule goes stale where a pointer does not.

## 6. Validate

Run the shipped checker first, from the repository root:

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/check-config.py
```

It reports missing sections, unanswered keys and dangling file paths. It cannot tell you a value is
*wrong*, only that a lookup will come back empty. Where `python3` is unavailable, do the same three
checks by reading.

Then check what the script cannot:

- Every section from the schema is present, with every key answered.
- Every file path in it exists.
- Every command in it runs — run the lint and test commands now, and correct the config if a
  command is wrong. This is the cheapest moment to find out.
- The tracker access works: fetch one real ticket and confirm the plan location holds what you
  expect on a ticket that has been planned before.

Then tell the user what you wrote, which values you detected, which they chose, and which keys still
carry a placeholder that needs their attention. Point them at `plan-ticket` for the next step.
