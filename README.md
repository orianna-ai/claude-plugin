# Setup

## Claude Code

```
/plugin marketplace add orianna-ai/claude-plugin
/plugin install softlight@orianna-ai-claude-plugin
```

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