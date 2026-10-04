# endjin Plugin Marketplace

A marketplace of endjin's plugins and skills for AI coding agents. It uses the [Claude Code plugin marketplace format](https://code.claude.com/docs/en/plugin-marketplaces), which [GitHub Copilot CLI also reads natively](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/plugins-marketplace) — so one repo serves both tools. The skills themselves use the cross-tool [Agent Skills standard](https://github.blog/changelog/2025-12-18-github-copilot-now-supports-agent-skills/) (SKILL.md), which is also understood by VS Code, Cursor, and Codex CLI.

## Structure

```
endjin-marketplace/
├── .claude-plugin/
│   └── marketplace.json          # Marketplace catalog (required)
└── plugins/
    ├── code-review-tools/        # One directory per plugin
    │   ├── .claude-plugin/
    │   │   └── plugin.json       # Plugin manifest
    │   └── skills/
    │       └── explain-diff-html/
    │           └── SKILL.md      # One directory per skill
    ├── writing-tools/
    │   ├── .claude-plugin/
    │   │   └── plugin.json
    │   └── skills/
    │       └── clear-technical-writing/  # Skills can ship references/ and scripts/ alongside SKILL.md
    │           ├── SKILL.md
    │           ├── references/
    │           └── scripts/
    └── backlog/                  # A mod: a hooks module instead of skills
        ├── .claude-plugin/
        │   └── plugin.json
        ├── hooks/
        │   ├── hooks.json        # Names the hooks module
        │   └── register.tsx      # The mod: pane, tools, /backlog
        ├── types/index.d.ts      # Item shape and state contract
        └── tests/                # Run with `claude plugin test`
```

Each plugin entry in `marketplace.json` references its directory with an explicit relative path (e.g. `"source": "./plugins/code-review-tools"`).

## Plugins

| Plugin | Kind | What it gives you |
| --- | --- | --- |
| [`code-review-tools`](#code-review-tools) | Skill | `explain-diff-html`: a rich, self-contained HTML explanation of a code change, branch, or PR |
| [`writing-tools`](#writing-tools) | Skill | `clear-technical-writing`: writes and rewrites technical text so it is plain, consistent, and inclusive |
| [`backlog`](#backlog) | Mod (Claude Code only) | A side pane that tracks the defects, issues, tasks and decisions your sessions turn up |

Install any of them with `/plugin install <plugin>@endjin` once the marketplace is added; see [Using the marketplace with Claude Code](#using-the-marketplace-with-claude-code).

### code-review-tools

`explain-diff-html` builds one HTML page that explains a code change to a reader who has not seen it. The page has four parts:

- **Background**: the existing system the change touches, with a deeper introduction that an experienced reader can skip.
- **Intuition**: the core idea of the change, shown with toy data and diagrams.
- **Code**: a walkthrough of the changes, grouped so they read in a sensible order.
- **Quiz**: five interactive multiple-choice questions that check you understood the change.

To use it, name the change you want explained:

```text
/code-review-tools:explain-diff-html the changes on this branch
/code-review-tools:explain-diff-html PR 42
```

You can also ask in your own words, for example "give me a rich explanation of this diff", and the agent picks the skill up from its description.

The page is saved as `.explanations/YYYY-MM-DD-explanation-<slug>.html` at the repository root, and `.explanations/` is added to `.gitignore`. Open the file in VS Code's Simple Browser or in your own browser.

### writing-tools

`clear-technical-writing` writes and rewrites technical text so that every reader, including one whose first language is not English, reads it correctly the first time. It applies short sentences, active voice, one term per concept, concrete values, and inclusive language.

It covers READMEs, API docs, ADRs, specifications, runbooks, changelogs, release notes, error messages, UI text, commit messages, data dictionaries, incident reports, model cards, and experiment reports. It carries separate guidance for application development, data engineering, and data science documents.

To use it, point it at the text:

```text
/writing-tools:clear-technical-writing rewrite docs/runbook.md
/writing-tools:clear-technical-writing review the error messages in src/api/errors.ts
```

You can also ask in your own words, for example "tighten this README" or "make this release note clearer".

The skill includes a checker script that flags long sentences, passive voice, complex tenses, inflated words, vague qualifiers, non-inclusive terms, Latin abbreviations, and long noun chains. The agent runs it on each draft and fixes what it finds. The checker needs Python 3 on `PATH`.

### backlog

`backlog` is a mod: it adds a pane to Claude Code that keeps the defects, issues, follow-up tasks and decisions from your sessions in one list, so they do not scroll away in the transcript. It needs a Claude Code build with mod support, and it does nothing in other agents.

To use it:

1. **Install it and reload.** The pane opens at session start in a terminal at least 144 columns wide. In a narrower terminal, run `/backlog` to open it.
2. **Work as usual.** When a piece of work ends, Claude records what it leaves behind: defects, issues, tasks, and decisions that need you. You can also tell it to, for example "add that to the backlog as a high-priority defect".
3. **Triage in the pane.** Items are grouped as Decisions, Defects, Issues and Tasks, and each group is sorted from critical to low. Select an item to read its full context and Claude's recommendation.
4. **Act on an item** from its detail view:
   - Pick one of a decision's options, or select **Accept recommendation**.
   - Select **Fix now** on a defect, issue or task.
   - Type in the **Direct** field to tell Claude what to do in your own words.
   - Select **Mark done** or **Dismiss**, or change the priority.

Deciding, fixing and directing each send the item to Claude as a prompt in the session where you pressed the button. Claude marks the item done, with a one-line resolution, when it finishes.

Every session that has the plugin enabled shares one backlog. Items are JSON files in `~/.claude/backlog/items/`. The pane shows the current project's items; select **All projects** to see the rest. The status line shows the open count, for example `backlog: 4 open, 1 to decide`.

See the [backlog README](plugins/backlog/README.md) for the tools Claude uses, the storage format, and how to develop the mod.

## Using the marketplace with Claude Code

Add the marketplace (once), then install plugins from it:

```shell
# From a local checkout (relative or absolute path)
/plugin marketplace add ./endjin-marketplace

# Or, once pushed to GitHub
/plugin marketplace add endjin/endjin-marketplace

# Install a plugin
/plugin install code-review-tools@endjin

# Activate in the current session (new sessions pick plugins up automatically)
/reload-plugins
```

To get the latest plugin changes later (versions track git commits, so every push to `main` is a new version):

```shell
# Update this marketplace and its installed plugins, then reload
/plugin marketplace update endjin
/reload-plugins

# Or update all registered marketplaces at once
/plugin marketplace update
```

Skills are namespaced by plugin: `explain-diff-html` is invoked as `/code-review-tools:explain-diff-html`, and `clear-technical-writing` as `/writing-tools:clear-technical-writing`. Claude also invokes a skill by itself when your request matches the skill's `description`. A mod such as `backlog` registers its own command (`/backlog`) with no namespace. [Plugins](#plugins) describes how to use each one.

Non-interactive (CI, scripts):

```bash
claude plugin marketplace add endjin/endjin-marketplace
claude plugin install code-review-tools@endjin --scope project
claude plugin marketplace update endjin
```

## Using the marketplace with GitHub Copilot CLI

Copilot CLI's plugin system mirrors Claude Code's and reads `.claude-plugin/marketplace.json` and `plugin.json` directly, so this marketplace works from Copilot CLI with no changes.

Register the marketplace and install ([docs](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/plugins-finding-installing)):

```shell
copilot plugin marketplace add endjin/endjin-marketplace
copilot plugin install code-review-tools@endjin
```

Or declaratively, in `~/.copilot/settings.json` (user) or `.github/copilot/settings.json` (repo):

```json
{
  "extraKnownMarketplaces": {
    "endjin": { "source": { "source": "github", "repo": "endjin/endjin-marketplace" } }
  },
  "enabledPlugins": { "code-review-tools@endjin": true }
}
```

Portability caveats for future plugins:

- Skills are fully portable; `commands/`, output styles, and the `renames` field are Claude Code-only (Copilot ignores them).
- Copilot supports only a subset of hook events (command handlers only) and ignores rich agent frontmatter (`model`, `permissionMode`, etc.).
- Mods (a `hooks/hooks.json` that names a hooks module under `modules`, as `backlog` does) are Claude Code-only.
- Never add an explicit `skills` field to `plugin.json` — both tools auto-discover `skills/`, and an explicit field breaks compatibility.

## Adding a new plugin

1. Create `plugins/<plugin-name>/` (kebab-case) with `.claude-plugin/plugin.json`:

   ```json
   {
     "name": "<plugin-name>",
     "description": "What the plugin does",
     "author": { "name": "endjin", "url": "https://endjin.com" }
   }
   ```

2. Add components at the plugin root (not inside `.claude-plugin/`):
   - `skills/<skill-name>/SKILL.md` — model-invoked skills; frontmatter `description` is required and tells Claude when to use it
   - `commands/<name>.md` — flat slash-command style skills
   - `agents/<name>.md` — subagent definitions
   - `hooks/hooks.json` — hooks (use `${CLAUDE_PLUGIN_ROOT}` for script paths)
   - `.mcp.json` — MCP server definitions

3. Register it in `.claude-plugin/marketplace.json` under `plugins`:

   ```json
   { "name": "<plugin-name>", "source": "./plugins/<plugin-name>", "description": "..." }
   ```

4. Validate before committing:

   ```bash
   claude plugin validate .
   ```

## Versioning

Plugin `version` is omitted deliberately: without it, every git commit counts as a new version and users pick up changes on `/plugin marketplace update`. If you add a `version` to a plugin, users only receive updates when you bump it.

## Gotchas

- Plugins cannot reference files outside their own directory (`../shared` breaks after install).
- Only `plugin.json` lives in a plugin's `.claude-plugin/` folder; everything else goes at the plugin root.
- Marketplace and plugin names must be kebab-case with no spaces.
- After installing or updating in an active session, run `/reload-plugins`.
