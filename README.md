# Setup

## Claude Code Terminal

```
/plugin marketplace add orianna-ai/claude-plugin
/plugin install softlight@orianna-ai-claude-plugin
```

## Claude Code Desktop App

1. Start in terminal. If they don't have "claude" command, get it installed.
    1. Step 1: Install Claude Code CLI (if needed)
        1. # macOS/Linux
            1. curl -fsSL https://claude.ai/install.sh | bash
        2. # macOS (Homebrew)
            1. brew install --cask claude-code
    2. Step 2: In terminal run the following commands to install the plugin
        1. /plugin marketplace add orianna-ai/claude-plugin
        2. /plugin install softlight@orianna-ai-claude-plugin
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

3. Add these MCP servers to the "mcpServers" block in the Desktop config,
   preserving any existing entries:

   "softlight": {
     "command": "npx",
     "args": ["-y", "mcp-remote", "https://softlight.orianna.ai/mcp/"],
     "env": {}
   },
   "playwright-parallel": {
     "command": "npx",
     "args": ["-y", "playwright-parallel-mcp@latest"],
     "env": {
       "PLAYWRIGHT_MCP_BROWSER": "chromium",
       "PLAYWRIGHT_MCP_ISOLATED": "true",
       "MAX_SESSIONS": "100"
     }
   }

4. Tell me to restart the Desktop app.
```

If they can't get this to work, just continue in terminal.

## Codex

```bash
# download or update the claude plugin
CLAUDE_PLUGIN_DIR="$HOME/.softlight/claude-plugin"
mkdir -p "$(dirname "$CLAUDE_PLUGIN_DIR")"

if [ -d "$CLAUDE_PLUGIN_DIR/.git" ]; then
  git -C "$CLAUDE_PLUGIN_DIR" pull --ff-only
else
  git clone https://github.com/orianna-ai/claude-plugin "$CLAUDE_PLUGIN_DIR"
fi

# update the codex configuration
CODEX_CONFIG_TOML="$HOME/.codex/config.toml"
mkdir -p "$(dirname "$CODEX_CONFIG_TOML")"
touch "$CODEX_CONFIG_TOML"

if ! grep -qF "[projects.\"$CLAUDE_PLUGIN_DIR\"]" "$CODEX_CONFIG_TOML"; then
  cat >> "$CODEX_CONFIG_TOML" <<EOF

[projects."$CLAUDE_PLUGIN_DIR"]
trust_level = "trusted"
EOF
fi

if ! grep -qF '[plugins."softlight@softlight-plugins"]' "$CODEX_CONFIG_TOML"; then
  cat >> "$CODEX_CONFIG_TOML" <<'EOF'

[plugins."softlight@softlight-plugins"]
enabled = true
EOF
fi
```
