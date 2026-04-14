# Setup

## Claude Code Terminal

```
/plugin marketplace add orianna-ai/claude-plugin
/plugin install softlight@orianna-ai-claude-plugin
```

## Claude Code Desktop App

1. Start in terminal. If they don't have "claude" command, get it installed.
    a. Step 1: Install Claude Code CLI (if needed)
        i. macOS/Linux
            1. curl -fsSL https://claude.ai/install.sh | bash
        ii. macOS (Homebrew)
            1. brew install --cask claude-code
    a. Step 2: In terminal run the following commands to install the plugin
        i. /plugin marketplace add orianna-ai/claude-plugin
       ii. /plugin install softlight@orianna-ai-claude-plugin
2. In the desktop app, paste these instructions

```
I just installed the Softlight plugin via the Claude Code terminal.
Finish the setup for the Claude Code Desktop app:

1. Find the Claude Desktop app config file (claude_desktop_config.json).
   Typical locations:
   - macOS: ~/Library/Application Support/Claude/claude_desktop_config.json
   - Windows: %APPDATA%\Claude\claude_desktop_config.json
   - Linux: ~/.config/Claude/claude_desktop_config.json
   If you can't find it, search for claude_desktop_config.json on disk.
   If it doesn't exist, create it with {}.

2. Confirm the plugin installed correctly. Check
   ~/.claude/plugins/installed_plugins.json for a "softlight@softlight-plugins"
   entry. If missing, the plugin wasn't installed — stop and tell me.

3. Open the contents of this file and copy/paste or add these MCP servers to the "mcpServers" block in the Desktop config,
   preserving any existing entries: https://raw.githubusercontent.com/orianna-ai/claude-plugin/refs/heads/main/plugins/softlight/.mcp.json

4. Tell me to restart the Desktop app.
```

If they can't get this to work, just continue in terminal.

## Codex

```bash
curl -fsSL https://raw.githubusercontent.com/orianna-ai/claude-plugin/refs/heads/main/scripts/setup-codex | bash
```

## Cursor

```bash
curl -fsSL https://raw.githubusercontent.com/orianna-ai/claude-plugin/refs/heads/main/scripts/setup-cursor | bash
```
