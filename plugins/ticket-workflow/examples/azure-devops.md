# Example: Azure DevOps work items, Azure Repos pull requests

A filled configuration for a .NET and TypeScript application with a Python data pipeline, tracked in
Azure Boards. Copy it to `.claude/ticket-workflow.md` and replace the specifics.

The nuance keys — **Test traps**, **Comment format**, **Worktrees** — are the ones worth copying in
spirit. Each records something that fails quietly.

Every path and identifier below is illustrative. Running `scripts/check-config.py` against this file
reports them as dangling, which is the checker working correctly — point it at your own repository.

---

# Ticket workflow configuration

## Tracker

- **System**: azure-devops
- **Access**: the `azure-devops` MCP server. Read `wit_get_work_item`; batch
  `wit_get_work_items_batch_by_ids`; update `wit_update_work_item`; comments
  `wit_list_work_item_comments`, `wit_add_work_item_comment`, `wit_update_work_item_comment`;
  children `wit_create_work_item` then `wit_add_child_work_items`.
- **Coordinates**: organisation `contoso-dev`, project `Acme.Analytics`, repository `Acme.Analytics`.
- **Ticket types**: Product Backlog Item, Task, Bug. A spike or a decision is a Task under its PBI.
- **Plan location**: `System.Description`, under an `## Implementation plan` heading — **except on
  Bug**, where the whole body lives in `Microsoft.VSTS.TCM.ReproSteps` and the other fields sit
  empty.
- **Acceptance criteria location**: `Microsoft.VSTS.Common.AcceptanceCriteria` on every type except
  Bug, where they are part of the repro-steps body. Never duplicate them into the plan field.
- **Body format**: per field, and per work item. Read `multilineFieldsFormat` from an **unprojected**
  `wit_get_work_item` — a `fields`-projected fetch returns it empty even when the field is in the
  projection. `markdown` takes a `## Implementation plan` heading; `html` takes
  `<h2>Implementation plan</h2>` with `<`, `>` and `&` escaped, and no tables or blockquotes, which
  do not survive the HTML pass. The sanitiser rewrites stored HTML, so match an existing heading
  tolerantly rather than byte for byte.
- **Comment format**: Markdown, posted with `format: Markdown`. The sanitiser strips angle-bracket
  tokens — write generics as `&lt;T&gt;` or in a code span, and never use an angle-bracket
  placeholder. Escape `|` as `\|` inside a table cell.
- **Comment editing**: supported, via `wit_update_work_item_comment`.
- **Blocking marker**: the `needs-review` tag. `System.Tags` is one semicolon-separated field and a
  write replaces all of it: to add, read the field, append, write back; to remove, write the list
  minus that tag. Match tags as exact tokens after splitting on `;`.
- **Child items**: `wit_create_work_item` with type `Task`, then `wit_add_child_work_items` under
  the PBI. Check a child's state with a batched `System.State` fetch.

## Source control

- **Host**: Azure Repos, same organisation and project.
- **Base branch**: `development`. It is the long-lived integration branch; `main` is production and
  is reached only by a pull request from `development`.
- **Branch naming**: `feature/{short-name}`. Spikes use `spike/{spike-name}` and are never merged.
- **Commit conventions**: granular commits, pushed after each. One commit per ticket at minimum
  where several are in flight. End each message with the project's `Co-Authored-By` trailer.
- **Rebase policy**: never rebase or force-push a shared branch.
- **Worktrees**: used for risky or parallel work.
  `git worktree add -b feature/{short-name} /home/dev/worktrees/{short-name} development`. The
  worktree path must sit under `/home/dev/worktrees/`, which is the persistent volume. A secondary
  worktree needs its **own `yarn install`** — the `node_modules` volume only covers the primary
  checkout. Only one application stack may run at a time across worktrees, so stop any running stack
  before starting one for verification.

## Pull requests

- **Access**: `repo_create_pull_request`, `repo_update_pull_request`,
  `repo_get_pull_request_by_id`, `repo_create_pull_request_thread`,
  `repo_list_pull_request_threads`, `repo_reply_to_comment`, `repo_update_pull_request_thread`.
- **Draft support**: yes. Open as a draft after the first push; `repo_update_pull_request` flips it
  to ready.
- **Linked work item**: required. Every pull request links its work item at creation.
- **Description limits**: 4000 characters, enforced on write. Overflow goes in a pull-request
  comment thread.

## Quality gates

- **Lint and format**: `cd app/frontend && yarn lint && yarn pretty`. The backend analyzers must be
  clean. The Husky pre-commit hook must pass.
- **Tests**: `dotnet test app/Acme.Backend.Core.Specs`; `cd app/frontend && yarn ci-test`; the UI
  automation suite; `cd pipeline && uv run pytest tests/unit`.
- **Test traps**: the UI automation suite needs `-p:RunUiAutomationTests=true`, a running
  application stack, and `az login` — without them a plain run **silently passes zero tests**. The
  frontend `yarn test` watches; `yarn ci-test` is the single-run form.
- **Manual verification**: browse the running application with the repository's authenticated
  browsing skill wherever the change is user-visible.
- **Additional gates**: documentation the plan requires is written; `CLAUDE.md` is updated when the
  change affects how the repository is built, run or tested.

## Code review

- **Reviewer**: the `code-review:code-review` plugin skill, at maximum effort, over the pull
  request's changes. **Use the namespaced name** — the bare `/code-review` resolves to a built-in
  command that cannot be model-invoked. The plugin is written for GitHub: pass the pull-request id,
  repository and branch in its arguments, and tell it to use the `azure-devops` MCP tools rather
  than `gh`.
- **Fallback**: an adversarial subagent over `git diff development...HEAD`.
- **Escalation**: `/code-review ultra`, the billed multi-agent cloud review, is user-triggered only.
  Suggest it; never launch it.
- **Finding disposition**: one thread per finding, inline against the file and line. Fix, push,
  reply explaining the fix, resolve as `fixed`. A false positive gets a reply carrying the
  justification and resolves as `wontFix`.

## Writing style

- **Ticket and PR register**: `.claude/rules/writing-ado.md`, over the sentence core in
  `.claude/rules/writing-ste100.md`.
- **Documentation register**: `.claude/rules/writing-docs.md`. Read it **before authoring** a new
  file under `docs/` — path-scoped rules fire on read, not on write.
- **Code comments**: never cite work-item ids in a comment, in any language. State the fact
  instead, and link the decision record for a decision.

## Project conventions

- **Context files**: `CLAUDE.md` at the root, the path-scoped rules in `.claude/rules/`, and the
  nested `CLAUDE.md` under `pipeline/`.
- **Architecture decisions**: `docs/architecture/adr/YYYY-MM-DD-<title-in-kebab-case>.md`, **no
  spaces** — `docs/` is published as a wiki and the file name becomes the page name. Header carries
  Status (start at Proposed), Deciders, Date and a work-item link, then Context and Problem
  Statement, the options with their trade-offs, and the Decision. A record goes on its own
  `feature/` branch and merges into `development` **ahead of, and separately from,** the
  implementation. A new dependency, a major new pattern, or a new technology triggers one.
- **Documentation**: `docs/`, published as a wiki. File names are page names: no spaces, kebab-case,
  and renaming a published page breaks its URL and every inbound link.
- **Post-PR steps**: the `/explain-pr` command, which generates the committed HTML diff explanation
  and comments on the pull request. **Ready-only** — check the draft flag first. It reads the
  repository's own rule for its conventions; do not restate them.
