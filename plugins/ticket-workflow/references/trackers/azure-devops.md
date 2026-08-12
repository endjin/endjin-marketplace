# Adapter: Azure DevOps

Read this when the config's **System** is `azure-devops`. It records the behaviour that costs a run
if you learn it the hard way. Your config still supplies the coordinates and the field choices.

Tool names below are the `azure-devops` MCP server's. A REST or `az boards` setup maps one to one.

## Fields

A work item's body is spread across named fields, and which field holds what depends on the type.

- `System.Description` holds the problem statement and the plan on most types.
- `Microsoft.VSTS.Common.AcceptanceCriteria` holds acceptance criteria, in its own field.
- **Bug** work items are the exception. The whole body, acceptance criteria included, conventionally
  lives in `Microsoft.VSTS.TCM.ReproSteps`, and the other two fields sit empty.

Read and write the field that matches the work-item type. Never duplicate acceptance criteria into
the plan field.

## Field format is per field, and the projection hides it

Each multiline field is stored as either markdown or HTML, per work item. The format is reported in
`multilineFieldsFormat` on `wit_get_work_item`.

**Fetch it unprojected.** A `fields`-projected fetch returns `multilineFieldsFormat` empty, even
when the field you asked about is in the projection. The value silently reads as unknown.

- `markdown` → write markdown, under a `## Implementation plan` heading.
- `html` → write HTML: an `<h2>Implementation plan</h2>` heading, `<`, `>` and `&` entity-escaped,
  and no markdown-only constructs. Tables and blockquotes do not survive the HTML pass.

Writing markdown into an HTML field renders as literal asterisks. Writing HTML into a markdown field
renders as literal tags. Neither errors.

The sanitiser rewrites stored HTML — it inserts whitespace before closing tags, among other things.
Match an existing heading tolerantly, never byte for byte.

## Comments

Post with `wit_add_work_item_comment` and `format: Markdown`. Edit in place with
`wit_update_work_item_comment`, which makes the review-round protocol work as designed.

The comment sanitiser strips angle-bracket tokens. Write generics escaped — `&lt;T&gt;` — or inside
a code span. Never put an angle-bracket placeholder in comment text; it vanishes. Escape `|` as
`\|` inside a table cell.

Comments come back as **HTML** from the REST API by default. Request markdown with `&format=markdown`
in the query when reading raw. Never try to unescape the returned text yourself — the sanitiser has
already eaten what looks like markup.

## Tags are one field

`System.Tags` is a single semicolon-separated string, and a write replaces the whole field.

- **Add** a tag: read the field, append to the list, write the list back.
- **Remove** a tag: write the list minus that one tag.

Split on `;`, trim, and match tags as exact tokens. A substring match on a tag name will find the
wrong thing eventually.

`needs-review` is the conventional blocking marker. Your config names the one you use.

## Fetching efficiently

Gate cheaply before you fetch everything:

- `wit_get_work_item` with `fields: [System.State, System.Tags]` answers the tag gate in one small
  call. A missing `System.Tags` key means no tags.
- `wit_get_work_items_batch_by_ids` batches several ids.
- `wit_get_work_item` with `expand: relations` returns every field **and** the child links in one
  call. The API rejects `fields` combined with `expand`, so do not add a separate plan-field
  projection alongside it.

## Child work items

`wit_create_work_item` creates the child — type `Task` under a Product Backlog Item. Then
`wit_add_child_work_items` links it under the parent. Check a child's state with a batched
`System.State` fetch.

## Pull requests

Azure Repos, through the same MCP server:

- `repo_create_pull_request` — set the draft flag, and link the work item. Most projects require a
  linked work item on every pull request.
- `repo_update_pull_request` — flips draft to ready, and edits the description.
- `repo_create_pull_request_thread` — an inline finding, against a file and line.
- `repo_list_pull_request_threads`, `repo_reply_to_comment`, `repo_update_pull_request_thread` —
  the reply-and-resolve cycle. Thread status values include `fixed`, `closed` and `wontFix`.
- `repo_get_pull_request_by_id` — read `isDraft` before any ready-only step.

**Pull-request descriptions are capped at 4000 characters.** Overflow goes in a comment thread. The
cap is enforced on write, so a long description fails late.

## Reviewer tooling

Review plugins are usually written for GitHub and reach for `gh`. Most detect a non-GitHub remote
and continue. Pass the pull-request id, repository and branch in the arguments, and tell the
reviewer to use the `azure-devops` MCP tools instead of `gh`.
