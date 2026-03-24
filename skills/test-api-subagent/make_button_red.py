#!/usr/bin/env python3
"""Prompt Claude to make the inspiration_public CTA button bright red.

Gives Claude read_file and write_file tools so it can explore the workspace
and make changes itself. The script is just a tool-use execution loop.
"""

import json
import subprocess
import sys

try:
    from anthropic import Anthropic
except (ImportError, AttributeError):
    subprocess.check_call([sys.executable, "-m", "pip", "install", "anthropic", "-q"])
    from anthropic import Anthropic

WORKSPACE = sys.argv[1] if len(sys.argv) > 1 else "/workspaces/orianna"

TOOLS = [
    {
        "name": "read_file",
        "description": "Read the contents of a file at the given path.",
        "input_schema": {
            "type": "object",
            "properties": {"path": {"type": "string", "description": "Absolute file path."}},
            "required": ["path"],
        },
    },
    {
        "name": "write_file",
        "description": "Write contents to a file at the given path (overwrites).",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Absolute file path."},
                "contents": {"type": "string", "description": "File contents to write."},
            },
            "required": ["path", "contents"],
        },
    },
    {
        "name": "list_directory",
        "description": "List files and directories at the given path.",
        "input_schema": {
            "type": "object",
            "properties": {"path": {"type": "string", "description": "Absolute directory path."}},
            "required": ["path"],
        },
    },
]


def handle_tool(name, input):
    import os

    if name == "read_file":
        with open(input["path"]) as f:
            return f.read()
    elif name == "write_file":
        with open(input["path"], "w") as f:
            f.write(input["contents"])
        return "OK"
    elif name == "list_directory":
        return "\n".join(os.listdir(input["path"]))
    else:
        return f"Unknown tool: {name}"


def main():
    client = Anthropic()
    messages = [
        {
            "role": "user",
            "content": (
                f"The workspace is at {WORKSPACE}. "
                "The app is at server/inspiration_public. "
                "Make the main CTA button on the homepage bright red."
            ),
        },
    ]

    while True:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            tools=TOOLS,
            messages=messages,
        )

        if response.stop_reason == "end_turn":
            for block in response.content:
                if hasattr(block, "text"):
                    print(block.text)
            break

        tool_results = []
        for block in response.content:
            if block.type == "tool_use":
                print(f"  -> {block.name}({json.dumps(block.input, indent=2)[:200]})")
                result = handle_tool(block.name, block.input)
                tool_results.append(
                    {"type": "tool_result", "tool_use_id": block.id, "content": result},
                )

        messages.append({"role": "assistant", "content": response.content})
        messages.append({"role": "user", "content": tool_results})


if __name__ == "__main__":
    main()
