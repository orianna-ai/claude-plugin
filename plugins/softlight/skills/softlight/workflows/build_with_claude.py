from scripts.call_claude import call_claude
from scripts.load_config import Config

from workflows.base import workflow


@workflow
def build_with_claude(
    config: Config,
    params: dict[str, str],
) -> None:
    call_claude(
        prompt="""\
The user did a design exploration in Softlight. They explored the design space on the canvas and
selected some design directions they want to implement. These design directions are prototypes —
sketches of the design implemented in a simplified clone of the running application. Your goal is to
take those sketched designs and implement them properly in the source code so the application is
fully functional and all user actions are accounted for.

If the design directions conflict with each other, make intelligent decisions to resolve the
conflicts based on the overall canvas and feedback you have seen the user give in the canvas.

Selected prototypes (use get_project to find these slots, then look at each slot's
**content_script** field and **screenshots** field — download and read them with curl to understand
the design change):

${slotList}

Additional user context the user left when they selected the design directions:

${contextSection}

You have access to the full canvas via get_project, which shows their entire design exploration —
all revisions, slots, and comment threads. Use it to understand their thought process:

- **Comment threads** are feedback the user left on specific prototypes. The screenshot field shows
  what part of the design they're referring to. Read the comments array for their notes.

- **Slots** are individual design variants. Compare the selected prototypes to other slots to
  understand what the user chose and what they passed on.

Your task is to implement the selected design directions into the app so the user can see it working
in their actual application.
""",
        params=params,
        config=config,
        effort="medium",
        model="opus",
        session_id="build_with_claude",
    )
