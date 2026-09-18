# SQLRooms Claude Code plugin

The canonical guidance remains in `../skills/sqlrooms`. The Python package build
copies that directory unchanged into this plugin's generated `skills/sqlrooms` and
packages the resulting plugin in the Python wheel. Do not edit generated copies.
Plugin generation runs after the cached UI build, so a Turbo cache hit still
recreates the plugin before packaging.

Run `node apps/sqlrooms-cli-ui/build-claude-plugin.mjs` from the repository root,
then load `python/sqlrooms/sqlrooms/claude_plugin` with Claude's `--plugin-dir`.
The launcher also passes `--mcp-config <plugin>/mcp.json`; the template expands
session endpoint and token environment variables without writing credentials.
The plugin does not start a runtime, choose a model, or install global settings.

Use `/sqlrooms:sqlrooms` to load the workflow. SQLRooms owns the live browser
workspace and approvals; Claude owns authentication and reasoning. See
[the launcher guide](../../../python/sqlrooms/README.md).
