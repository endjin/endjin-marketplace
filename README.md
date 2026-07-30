# endjin Plugin Marketplace

A marketplace of endjin's plugins and skills for AI coding agents. It uses the [Claude Code plugin marketplace format](https://code.claude.com/docs/en/plugin-marketplaces), which [GitHub Copilot CLI also reads natively](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/plugins-marketplace) — so one repo serves both tools. The skills themselves use the cross-tool [Agent Skills standard](https://github.blog/changelog/2025-12-18-github-copilot-now-supports-agent-skills/) (SKILL.md), which is also understood by VS Code, Cursor, and Codex CLI.

## Structure

```
endjin-marketplace/
├── .claude-plugin/
│   └── marketplace.json          # Marketplace catalog (required)
└── plugins/
    └── code-review-tools/        # One directory per plugin
        ├── .claude-plugin/
        │   └── plugin.json       # Plugin manifest
        └── skills/
            └── explain-diff-html/
                └── SKILL.md      # One directory per skill
```

Each plugin entry in `marketplace.json` references its directory with an explicit relative path (e.g. `"source": "./plugins/code-review-tools"`).

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

Skills are namespaced by plugin: for example, `explain-diff-html` (which builds a rich, self-contained HTML explanation of a code change, branch, or PR — with background, intuition, a code walkthrough, and an interactive quiz) is invoked as `/code-review-tools:explain-diff-html`, or Claude invokes it automatically based on its `description` when you ask for a rich explanation of a diff.

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
