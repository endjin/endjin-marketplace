# Example: GitHub Issues, GitHub pull requests

A filled configuration for a TypeScript monorepo tracked in GitHub Issues, driven from the `gh` CLI.
Copy it to `.claude/ticket-workflow.md` and replace the specifics.

Note how much shorter the tracker section is than the Azure DevOps example. One markdown body and
one comment format removes most of the field and escaping nuance — so the effort moves to the
quality gates, where this repository's real traps live.

Every path and identifier below is illustrative. Running `scripts/check-config.py` against this file
reports them as dangling, which is the checker working correctly — point it at your own repository.

---

# Ticket workflow configuration

## Tracker

- **System**: github-issues
- **Access**: the `gh` CLI, authenticated as the repository owner. Read
  `gh issue view <n> --json number,title,body,labels,state`; update `gh issue edit <n> --body-file`
  — always from a file, never a shell-quoted `--body`; list comments
  `gh api /repos/acme/widgets/issues/<n>/comments`; add `gh issue comment <n> --body-file`; edit
  `gh api --method PATCH /repos/acme/widgets/issues/comments/<id> -F body=@<path>`.
- **Coordinates**: `acme/widgets`.
- **Ticket types**: issues, distinguished by label — `type:feature`, `type:bug`, `type:spike`. No
  per-type field differences.
- **Plan location**: the issue body, under an `## Implementation plan` heading, kept last so a
  rewrite never disturbs what sits above it.
- **Acceptance criteria location**: the same body, under `## Acceptance criteria`, above the plan.
- **Body format**: GitHub-flavoured markdown, always. Capped at 65,536 characters.
- **Comment format**: GitHub-flavoured markdown. No sanitiser rewriting — tables, task lists and
  fenced code all survive.
- **Comment editing**: supported, by comment id through the REST API. `--edit-last` is not enough;
  it only reaches your own most recent comment.
- **Blocking marker**: the `needs-review` label. `gh issue edit <n> --add-label needs-review` and
  `--remove-label`. Label changes are independent, so no read-modify-write is needed. The label
  already exists in this repository.
- **Child items**: sub-issues.
  `gh api --method POST /repos/acme/widgets/issues/<parent>/sub_issues -F sub_issue_id=<child-id>`,
  where `sub_issue_id` is the issue's internal id from `gh issue view <n> --json id`, not its number.

## Source control

- **Host**: GitHub, `acme/widgets`.
- **Base branch**: `main`. Every change lands by pull request; direct pushes are blocked by branch
  protection.
- **Branch naming**: `feat/{short-name}`, `fix/{short-name}`, `chore/{short-name}`.
- **Commit conventions**: Conventional Commits, one logical change per commit, pushed after each.
  No trailer required.
- **Rebase policy**: rebase your own branch onto `main` freely before review. Never force-push a
  branch someone else has reviewed — push a fixup commit instead.
- **Worktrees**: not used. A second checkout works, but `pnpm install` must be re-run in it.

## Pull requests

- **Access**: `gh pr create`, `gh pr ready`, `gh pr view --json`, `gh pr checks`; inline findings
  through `gh api --method POST /repos/acme/widgets/pulls/<n>/comments`; resolution through the
  GraphQL `resolveReviewThread` mutation, which has no REST equivalent.
- **Draft support**: yes. `gh pr create --draft`, then `gh pr ready <n>`.
- **Linked work item**: the issue is referenced from the pull-request body. Use `Closes #<n>` only
  when this pull request finishes the issue; otherwise `Refs #<n>`.
- **Description limits**: 65,536 characters. Not a practical constraint; length discipline is a
  style choice here, not a cap.

## Quality gates

- **Lint and format**: `pnpm lint` and `pnpm format` at the repository root. Both run across every
  workspace.
- **Tests**: `pnpm test` (unit, Vitest); `pnpm test:integration` (needs Docker); `pnpm test:e2e`
  (Playwright).
- **Test traps**: `pnpm test:integration` starts its containers through Testcontainers and **skips
  silently** when the Docker socket is unavailable — check the summary line for a skip count rather
  than trusting the exit code. `pnpm test:e2e` needs `pnpm exec playwright install` once per
  machine, and a built application: run `pnpm build` first or it tests the last build.
- **Manual verification**: `pnpm dev`, then drive the affected page with the Playwright MCP tools.
- **Additional gates**: a changeset (`pnpm changeset`) for any user-facing change; the README
  updated where a public API changes.

## Code review

- **Reviewer**: the `code-review:code-review` plugin skill at maximum effort, over the pull request.
- **Fallback**: an adversarial subagent over `git diff main...HEAD`.
- **Escalation**: `/code-review ultra` is user-triggered only. Suggest it; never launch it.
- **Finding disposition**: one inline review comment per finding. Fix, push, reply explaining the
  fix, then resolve the thread. A won't-fix gets a reply carrying the justification and is resolved
  the same way — GitHub has no distinct won't-fix status, so the reply is the only record.

## Writing style

- **Ticket and PR register**: plain technical English. Short sentences, active voice, one fact each,
  no filler. Bold the key parameters.
- **Documentation register**: `docs/CONTRIBUTING-DOCS.md`.
- **Code comments**: explain why, not what. No issue numbers in comments — they rot when an issue is
  rescoped.

## Project conventions

- **Context files**: `AGENTS.md` at the repository root, and the per-package `AGENTS.md` files under
  `packages/*/`.
- **Architecture decisions**: `docs/decisions/NNNN-title.md`, numbered sequentially, using MADR.
  A new dependency or a change to a published interface triggers one. It merges ahead of the
  implementation, in its own pull request.
- **Documentation**: `docs/`, published with the site build. No file-naming constraints beyond
  kebab-case.
- **Post-PR steps**: none.
