# Adapter: GitHub

Read this when the config's **System** is `github-issues`. Commands below use the `gh` CLI. The
GitHub MCP server exposes the same operations under different names; the semantics are what matter.

## The issue body is one field

An issue has a single markdown body. There is no separate acceptance-criteria field, so both the
plan and the criteria live in that body as headed sections:

```markdown
## Problem

## Acceptance criteria

## Implementation plan
```

The skills locate each by heading. Keep the headings stable, and keep the plan section last so
rewriting it never disturbs the rest.

Read and write with:

```bash
gh issue view <n> --json number,title,body,labels,state
gh issue edit <n> --body-file <path>
```

Write the body from a file. A shell-quoted `--body` mangles backticks, dollar signs and newlines.

The body is capped at **65,536 characters**. Long plans are a signal to split the issue, not to
compress harder.

## Markdown is markdown

GitHub renders GitHub-flavoured markdown in issues, comments and pull-request descriptions, with no
sanitiser surprises. Tables, task lists and fenced code all survive. This is the easy case — spend
the attention you save on the review-round markers instead.

## Comments

```bash
gh issue comment <n> --body-file <path>
gh api /repos/{owner}/{repo}/issues/<n>/comments --jq '.[] | {id, body, created_at}'
gh api --method PATCH /repos/{owner}/{repo}/issues/comments/<comment-id> -F body=@<path>
```

Editing by comment id is what the review-round protocol needs, so set **Comment editing: supported**
in your config. `gh issue comment <n> --edit-last` only reaches your own most recent comment, which
is not enough once a round comment is followed by anything else.

## Labels replace nothing

Unlike a single tags field, label changes are additive and independent:

```bash
gh issue edit <n> --add-label needs-review
gh issue edit <n> --remove-label needs-review
```

The label must already exist in the repository. Create it once, or `gh label create needs-review`
on first use.

## Child items

GitHub sub-issues express a spike or decision as a real child:

```bash
gh api --method POST /repos/{owner}/{repo}/issues/<parent>/sub_issues -F sub_issue_id=<child-id>
```

Note that `sub_issue_id` takes the issue's **internal id**, not its number — read it from
`gh issue view <n> --json id` on the REST representation.

Where sub-issues are unavailable, fall back to a task list in the parent body referencing each
child by number, and state in the plan that implementation is blocked until each closes.

## Pull requests

```bash
gh pr create --draft --base main --title <t> --body-file <path>
gh pr ready <n>
gh pr view <n> --json number,isDraft,url,statusCheckRollup
```

Link the issue from the pull-request body — `Closes #123` closes it on merge, `Refs #123` links
without closing. Pick deliberately: a plan-carrying issue is often not finished by one pull request.

Inline review findings and their resolution:

```bash
gh api --method POST /repos/{owner}/{repo}/pulls/<n>/comments \
  -F body=@<path> -f commit_id=<sha> -f path=<file> -F line=<n> -f side=RIGHT
gh pr view <n> --json reviewThreads
```

**Resolving a thread needs GraphQL.** There is no REST route:

```bash
gh api graphql -f query='mutation($id:ID!){resolveReviewThread(input:{threadId:$id}){thread{isResolved}}}' -f id=<thread-id>
```

A "won't fix" is a reply stating the justification, then the same resolve mutation. GitHub has no
distinct won't-fix status, so the justification in the reply is the only record — make it explicit.

## Checks

`gh pr checks <n>` reports CI. Where the config's quality gates are also enforced by CI, run them
locally first anyway. Waiting on a remote round trip to learn that a formatter would have caught it
is the slow way round.
