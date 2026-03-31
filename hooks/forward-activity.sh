#!/bin/bash
#
# Forward Claude Code hook payloads to the Softlight activity endpoint.
# Reads the server URL from .mcp.json so it works for both local and remote deployments.
#
# On each hook event, also reads any new assistant messages from the transcript
# JSONL file and forwards them. This runs on the user's machine (where the file
# exists) rather than the server, so it works for remote deployments too.

PAYLOAD=$(cat)

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
CACHE_FILE="${PLUGIN_ROOT}/.activity-url-cache"
MCP_JSON="${PLUGIN_ROOT}/.mcp.json"
PROJECT_ID_FILE="${PLUGIN_ROOT}/.current-project-id"

# Resolve the Softlight server URL (cached after first resolution).
if [ -f "$CACHE_FILE" ]; then
  read -r BASE_URL < "$CACHE_FILE"
else
  [ -f "$MCP_JSON" ] || exit 0
  BASE_URL=$(node -p "new URL(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).mcpServers.softlight.url).origin" "$MCP_JSON" 2>/dev/null)
  [ -n "$BASE_URL" ] || exit 0
  printf '%s' "$BASE_URL" > "$CACHE_FILE"
fi

# Forward the original hook event in the background.
curl -s -X POST "${BASE_URL}/api/agent-activity" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  --connect-timeout 2 --max-time 4 >/dev/null 2>&1 &

# --- Extract new assistant messages from the transcript ---
node -e "
  const fs = require('fs');
  const payload = JSON.parse(process.argv[1]);
  const pluginRoot = process.argv[2];
  const transcriptPath = payload.transcript_path;
  const sessionId = payload.session_id || '';
  const hookEvent = payload.hook_event_name || '';

  // --- Project ID tracking ---
  // Learn project_id from MCP tool_input (PostToolUse events carry it).
  const projectIdFile = pluginRoot + '/.current-project-id';
  let projectId = '';
  const toolInput = payload.tool_input || {};
  if (toolInput.project_id) {
    projectId = String(toolInput.project_id);
    try { fs.writeFileSync(projectIdFile, projectId); } catch {}
  } else {
    try { projectId = fs.readFileSync(projectIdFile, 'utf8').trim(); } catch {}
  }

  // On Stop/StopFailure/SessionEnd events, clean up cached state.
  if (hookEvent === 'Stop' || hookEvent === 'StopFailure' || hookEvent === 'SessionEnd') {
    try { fs.unlinkSync(projectIdFile); } catch {}
  }

  // --- Transcript tailing ---
  if (!transcriptPath) process.exit(0);

  let stat;
  try { stat = fs.statSync(transcriptPath); } catch { process.exit(0); }

  // Per-transcript offset file.
  const crypto = require('crypto');
  const hash = crypto.createHash('md5').update(transcriptPath).digest('hex').slice(0, 8);
  const offsetFile = pluginRoot + '/.transcript-offset-' + hash;

  let prevOffset = 0;
  try { prevOffset = parseInt(fs.readFileSync(offsetFile, 'utf8'), 10) || 0; } catch {}

  const fileSize = stat.size;
  if (fileSize <= prevOffset) process.exit(0);

  // Read only the new bytes.
  const fd = fs.openSync(transcriptPath, 'r');
  const buf = Buffer.alloc(fileSize - prevOffset);
  fs.readSync(fd, buf, 0, buf.length, prevOffset);
  fs.closeSync(fd);

  // Save new offset.
  fs.writeFileSync(offsetFile, String(fileSize));

  // On Stop/StopFailure/SessionEnd events, also clean up the offset file after final read.
  if (hookEvent === 'Stop' || hookEvent === 'StopFailure' || hookEvent === 'SessionEnd') {
    try { fs.unlinkSync(offsetFile); } catch {}
  }

  // Process each new JSONL line.
  const lines = buf.toString('utf8').split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);

      // Claude Code transcript format: {type: 'assistant', message: {content: [...]}}
      if (obj.type !== 'assistant') continue;
      const content = obj.message && obj.message.content;
      if (!content) continue;

      let text = '';
      if (typeof content === 'string') {
        text = content.trim();
      } else if (Array.isArray(content)) {
        text = content
          .filter(b => b.type === 'text' && b.text)
          .map(b => b.text.trim())
          .filter(Boolean)
          .join('\n');
      }
      if (!text) continue;

      // Include project_id so the server can route without session mapping.
      const entry = {
        hook_event_name: 'AssistantMessage',
        session_id: sessionId,
        message: text.slice(0, 2000)
      };
      if (projectId) {
        entry.tool_input = { project_id: projectId };
      }
      console.log(JSON.stringify(entry));
    } catch {}
  }
" "$PAYLOAD" "$PLUGIN_ROOT" 2>/dev/null | while IFS= read -r entry; do
  [ -z "$entry" ] && continue
  curl -s -X POST "${BASE_URL}/api/agent-activity" \
    -H "Content-Type: application/json" \
    -d "$entry" \
    --connect-timeout 2 --max-time 4 >/dev/null 2>&1 &
done
