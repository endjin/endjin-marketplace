# Configuration schema

The ticket-workflow skills carry the **protocol**. Your repository supplies the **facts**: which
tracker holds the tickets, where the plan is written, what "green" means, who reviews.

Those facts live in one markdown file. The skills read it before they touch anything else, and they
refuse to guess a value it does not supply.

## Where the file lives

The skills search this order and use the first file that exists:

1. `.claude/ticket-workflow.md`
2. `.github/ticket-workflow.md`
3. `.agents/ticket-workflow.md`
4. `ticket-workflow.md` (repository root)

Generate it with the `ticket-workflow-init` skill, or copy `templates/ticket-workflow.md` and fill
it in.

## How the file is read

The file is prose, read by a model, not parsed by code. That is deliberate: half of what a workflow
needs to know is nuance ("the sanitiser eats angle brackets", "the e2e suite silently passes zero
tests without this flag"), and nuance does not survive a JSON schema.

Two rules keep it dependable:

- **Section headings are the contract.** Keep the `##` headings exactly as listed below. The skills
  locate values by heading, then by the **bold key** at the start of a bullet.
- **State the value or state its absence.** A missing key reads as unknown, and the skills stop and
  ask. A key answered `None` or `Not applicable` reads as a decision, and the skills carry on.

Add extra bullets to any section freely. Extra prose informs the model; it never breaks a lookup.

## Sections

### `## Tracker`

Required. Where the tickets live, and how to read and write them.

| Key | Meaning |
| --- | --- |
| **System** | `azure-devops`, `github-issues`, `jira`, `linear`, or any other name. Drives which adapter reference the skills read. |
| **Access** | How to reach it: an MCP server name, a CLI, or a REST endpoint. Name the specific tools for read, update, comment-list, comment-add and comment-edit. |
| **Coordinates** | The identifiers a call needs: organisation, project, repository, board, or nothing. |
| **Ticket types** | The types you use, and any per-type differences the other keys depend on. |
| **Plan location** | Where the `## Implementation plan` section is written — a named field, or a section of the ticket body. State the per-type exceptions here. |
| **Acceptance criteria location** | The same, for acceptance criteria. Say so plainly when they share the body with the plan. |
| **Body format** | `markdown`, `html`, or how to discover the format per field at runtime. The skills will not write markdown into an HTML field. |
| **Comment format** | The format comments accept, plus every escaping trap that applies. |
| **Comment editing** | `supported` or `unsupported`. Drives the review-round fallback in `references/review-rounds.md`. |
| **Blocking marker** | The tag, label, or field value meaning *a human must decide before implementation starts*. Include how to add and remove it. |
| **Child items** | How to create a child ticket and link it to its parent, for spikes and decisions. `Not supported` is a valid answer — the skills then track those in the plan text alone. |

### `## Source control`

Required.

| Key | Meaning |
| --- | --- |
| **Host** | Where the code and pull requests live. Often, but not always, the same system as the tracker. |
| **Base branch** | The branch feature work starts from and merges back into. |
| **Branch naming** | The pattern, for example `feature/{short-name}`. |
| **Commit conventions** | Message style, any required trailer, granularity and push cadence. |
| **Rebase policy** | What must never be rebased or force-pushed. |
| **Worktrees** | Whether isolated worktrees are used, where they must live, and what breaks in a secondary worktree. `Not used` is a valid answer. |

### `## Pull requests`

Required.

| Key | Meaning |
| --- | --- |
| **Access** | The tools that create a pull request, update it, list its threads, and reply to a comment. |
| **Draft support** | Whether a draft state exists, and how to flip it to ready. |
| **Linked work item** | Whether a pull request must reference its ticket, and how the link is made. |
| **Description limits** | Any hard cap on length or format, and where overflow goes. |

### `## Quality gates`

Required. The definition of done, as commands.

| Key | Meaning |
| --- | --- |
| **Lint and format** | The exact commands. |
| **Tests** | The exact commands, one per suite. Include every suite that must be green before review. |
| **Test traps** | Anything that makes a suite lie — a flag that gates the run, a service that must be up, an authentication step. This key earns its place. |
| **Manual verification** | How a user-visible change is confirmed in the running application, or `Not applicable`. |
| **Additional gates** | Documentation updates, changelog entries, telemetry, anything else that blocks review. |

### `## Code review`

Required.

| Key | Meaning |
| --- | --- |
| **Reviewer** | The skill, command, or agent that reviews the change, with the arguments it needs. |
| **Fallback** | What to do when the reviewer is unavailable. Default: an adversarial subagent over the branch diff. |
| **Escalation** | Any deeper review that only a human may launch. The skills will suggest it and never start it. |
| **Finding disposition** | How a finding is recorded, answered, and closed on a pull request. |

### `## Writing style`

Required. Registers differ per audience, so name the file that governs each.

| Key | Meaning |
| --- | --- |
| **Ticket and PR register** | The file to read before writing ticket text, plan text, or a pull-request description. `Plain technical English` is a valid answer when no such file exists. |
| **Documentation register** | The file to read before authoring documentation. Path-scoped rules fire on read and not on write, so a new file needs the rule named here. |
| **Code comments** | Any local constraint — for example, a ban on citing ticket ids in comments. |

### `## Project conventions`

Required.

| Key | Meaning |
| --- | --- |
| **Context files** | The files that already carry repository guidance: `CLAUDE.md`, `AGENTS.md`, a rules directory. The skills read them; they do not duplicate them. |
| **Architecture decisions** | Where decision records live, how they are named, what triggers one, and how one is reviewed and merged. `Not used` is a valid answer. |
| **Documentation** | Where documentation lives and any naming constraint that breaks silently, such as a wiki publishing the folder. |
| **Post-PR steps** | Anything that runs once the pull request is ready — a diff explanation, a deployment, a notification. |

## Worked examples

- `examples/azure-devops.md` — Azure DevOps work items, Azure Repos pull requests, a .NET and
  TypeScript repository.
- `examples/github.md` — GitHub Issues, GitHub pull requests, the `gh` CLI.

## Adapting an unlisted tracker

`references/trackers/` holds one file per tracker the plugin knows in detail. When your **System**
value has no file there, the skills fall back to the config alone. Make these keys carry more
detail in that case:

- **Access** — name every tool call, with its arguments, rather than the tool family.
- **Body format** and **Comment format** — state the escaping rules exactly. Sanitisers that eat
  angle brackets or collapse tables are common and each one is silent.
- **Comment editing** — get this right. The whole review-round protocol depends on it.

A new `references/trackers/<system>.md` file is the durable fix. Contributions are welcome.
