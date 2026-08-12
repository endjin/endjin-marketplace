# Ticket workflow configuration

<!--
  Read by the ticket-workflow plugin's plan-ticket and implement-ticket skills.
  Keep the ## headings and the **bold keys** exactly as they are — both skills look values up by
  heading, then by key. Add extra bullets freely; extra prose informs, it never breaks a lookup.
  Every key needs an answer. "None", "Not used" and "Not applicable" are answers. A missing key
  reads as unknown and stops a run.
  The schema, with what each key means: references/config-schema.md in the plugin.
-->

## Tracker

- **System**: <!-- azure-devops | github-issues | jira | linear | other -->
- **Access**: <!-- MCP server or CLI, and the specific operations for read, update, list comments, add comment, edit comment -->
- **Coordinates**: <!-- organisation / project / repository / board ids, or None -->
- **Ticket types**: <!-- the types in use, and any per-type differences the keys below depend on -->
- **Plan location**: <!-- the field or body section holding `## Implementation plan`, including per-type exceptions -->
- **Acceptance criteria location**: <!-- field or body section; say so plainly if it shares the body with the plan -->
- **Body format**: <!-- markdown | html | how to discover it per field at runtime -->
- **Comment format**: <!-- the format comments accept, and every escaping trap that applies -->
- **Comment editing**: <!-- supported | unsupported -->
- **Blocking marker**: <!-- the tag, label or state meaning "a human must decide", and how to add and remove it -->
- **Child items**: <!-- how to create a child ticket and link it to its parent, or Not supported -->

## Source control

- **Host**: <!-- where the code and pull requests live -->
- **Base branch**: <!-- the branch feature work starts from and merges into -->
- **Branch naming**: <!-- e.g. feature/{short-name} -->
- **Commit conventions**: <!-- message style, required trailer, granularity, push cadence -->
- **Rebase policy**: <!-- what must never be rebased or force-pushed -->
- **Worktrees**: <!-- whether used, where they must live, what breaks in a secondary worktree, or Not used -->

## Pull requests

- **Access**: <!-- the operations that create, update, list threads and reply -->
- **Draft support**: <!-- whether a draft state exists, and how to flip it to ready -->
- **Linked work item**: <!-- whether a link to the ticket is required, and how it is made -->
- **Description limits**: <!-- any hard cap, and where overflow goes -->

## Quality gates

- **Lint and format**: <!-- the exact commands -->
- **Tests**: <!-- the exact commands, one per suite -->
- **Test traps**: <!-- anything that makes a suite lie: a gating flag, a service that must be up, a sign-in -->
- **Manual verification**: <!-- how a user-visible change is confirmed in the running app, or Not applicable -->
- **Additional gates**: <!-- documentation, changelog, telemetry, anything else blocking review -->

## Code review

- **Reviewer**: <!-- the skill, command or agent that reviews, and the arguments it needs -->
- **Fallback**: <!-- what to do when the reviewer is unavailable -->
- **Escalation**: <!-- any deeper review only a human may launch -->
- **Finding disposition**: <!-- how a finding is recorded, answered and closed -->

## Writing style

- **Ticket and PR register**: <!-- the file to read before writing ticket, plan or PR text -->
- **Documentation register**: <!-- the file to read before authoring documentation -->
- **Code comments**: <!-- any local constraint, e.g. no ticket ids in comments -->

## Project conventions

- **Context files**: <!-- CLAUDE.md, AGENTS.md, rules directories -->
- **Architecture decisions**: <!-- where records live, naming, what triggers one, how one is reviewed and merged, or Not used -->
- **Documentation**: <!-- where documentation lives, and any naming constraint that breaks silently -->
- **Post-PR steps**: <!-- anything that runs once the PR is ready; mark any step that is ready-only -->
