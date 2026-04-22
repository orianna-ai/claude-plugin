from scripts.call_claude import call_claude
from scripts.load_config import Config

from workflows.base import workflow


@workflow
def reply_to_comment(
    config: Config,
    params: dict[str, str],
) -> None:
    call_claude(
        prompt="""\
The user left a comment on the design canvas (slot_id="${slotId}"):

"${commentText}"

Your task is to reply to the comment in the thread using create_comment with the project_id
and slot_id "${slotId}".

For additional context, you can call get_project to see the full thread history and canvas state.
You can find the comment thread with slot_id "${slotId}" to see the full thread.
The comment thread slot also has a screenshot URL that shows where the comment was dropped on
the canvas. Download it to see what the user is referring to. The screenshot has visual
annotations: a blue dot marks the exact drop point, and if the user dragged to select specific
elements on a prototype, a brown dashed box outlines that selection. Not every comment has the
box — a simple click produces only the dot — but when present, the box shows which part of the
design the feedback is about.

**CRITICAL CONSTRAINTS — READ CAREFULLY:**
- NEVER call any revision-generating tool. You are ONLY replying to comments.
- Do NOT promise to create revisions or new designs. You cannot do that from this context.
- If the user is requesting design changes, acknowledge their feedback and suggest options they
  could explore in future revisions, but do NOT attempt to generate those revisions yourself.
- Your sole output is a comment reply via create_comment. Nothing else.
""",
        params=params,
        config=config,
        effort="medium",
        model="opus",
        session_id=f"reply_to_comment:{params['slotId']}",
    )
