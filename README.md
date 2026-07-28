# endjin Claude Code Marketplace

A [Claude Code plugin marketplace](https://code.claude.com/docs/en/plugin-marketplaces) for sharing endjin's plugins and skills.

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

## Using the marketplace

Add the marketplace (once), then install plugins from it:

```shell
# From a local checkout (relative or absolute path)
/plugin marketplace add ./endjin-marketplace

# Or, once pushed to GitHub
/plugin marketplace add endjin/endjin-marketplace

# Install a plugin
/plugin install code-review-tools@endjin
```

Skills are namespaced by plugin: for example, `explain-diff-html` (which builds a rich, self-contained HTML explanation of a code change, branch, or PR — with background, intuition, a code walkthrough, and an interactive quiz) is invoked as `/code-review-tools:explain-diff-html`, or Claude invokes it automatically based on its `description` when you ask for a rich explanation of a diff.

Non-interactive (CI, scripts):

```bash
claude plugin marketplace add endjin/endjin-marketplace
claude plugin install code-review-tools@endjin --scope project
```

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
