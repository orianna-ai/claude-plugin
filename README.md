# Setup

## Prerequisites

You need **Node.js version 20 or higher** installed before running any of the setup steps below.

```bash
node --version
```

If you don't have Node.js or it is older than v20, pick one of the installation methods:

- **nvm (recommended, macOS/Linux)**:

   ```bash
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
   source ~/.nvm/nvm.sh
   nvm install 25
   nvm use 25
   ```

- **Homebrew (macOS)**:

   ```bash
   brew install node
   ```

- **Linux (apt)**:

   ```bash
   curl -fsSL https://deb.nodesource.com/setup_25.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

After installing, re-run `node --version` to confirm it reports `v20` or higher.

## Claude Code Terminal

```bash
/plugin marketplace add orianna-ai/claude-plugin
/plugin install softlight@orianna-ai-claude-plugin
```

## Claude Code Desktop

Follow the [Claude Code Terminal](#claude-code-terminal) setup instructions.

Then, paste the following prompt into the Claude Code Desktop app.

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

3. Open the contents of this file and copy/paste or add these MCP servers to the "mcpServers" block
   in the Desktop config, preserving any existing entries: https://raw.githubusercontent.com/orianna-ai/claude-plugin/refs/heads/main/plugins/softlight/.mcp.json

4. Tell me to restart the Desktop app.
```

## Codex

```bash
curl -fsSL https://raw.githubusercontent.com/orianna-ai/claude-plugin/refs/heads/main/scripts/setup-codex | bash
```

## Cursor

```bash
curl -fsSL https://raw.githubusercontent.com/orianna-ai/claude-plugin/refs/heads/main/scripts/setup-cursor | bash
```
