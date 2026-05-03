import json
import uuid
from typing import TypedDict

from scripts.call_claude import call_claude
from scripts.get_project import get_project
from scripts.load_config import Config
from scripts.post_events import post_events

from workflows.base import workflow


class GenerateTopicsParams(TypedDict):
    pass


@workflow
def generate_topics(
    config: Config,
    params: GenerateTopicsParams,
) -> None:
    """Decide which topics the LiveKit agent should ask the user about next."""
    project = get_project(config)

    conversations = project.get("conversations") or []

    decision = call_claude(
        prompt=[
            """\
You are the senior product designer guiding a live intake conversation through an intermediary
voice agent. Your job is to decide what topics the agent should ask about next.

A good topic is a concise spoken instruction asking for product, user, workflow, goal, constraint,
data, edge-case, or tradeoff context that would change the design. Do NOT ask for UI preferences
(card vs. table, visual style, etc.) — ask for the underlying context that would make the right
design choice clear.

Use 1-5 topics, ordered by priority (most important first). Keep each topic short and natural —
something the agent can say out loud without sounding like a script.

<existing_topics>
${existing_topics}
</existing_topics>

<conversations>
${conversations}
</conversations>
""",
            *(
                {
                    "type": "image",
                    "source": {"type": "url", "url": screenshot["image"]["url"]},
                }
                for conversation in conversations
                for screenshot in conversation.get("screenshots") or []
            ),
        ],
        params={
            "existing_topics": json.dumps(project.get("topics") or [], indent=2),
            "conversations": json.dumps(conversations, indent=2),
        },
        config=config,
        effort="low",
        json_schema={
            "type": "object",
            "properties": {
                "topics": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "text": {"type": "string"},
                        },
                        "required": ["text"],
                        "additionalProperties": False,
                    },
                },
            },
            "required": ["topics"],
            "additionalProperties": False,
        },
        model="opus",
        session_id="generate_topics",
    )

    post_events(
        config=config,
        events=[
            {
                "type": "topic_created",
                "metadata": {"id": uuid.uuid4().hex},
                "topic": {
                    "metadata": {"id": uuid.uuid4().hex},
                    "text": topic["text"],
                },
            }
            for topic in decision["topics"]
        ],
    )
