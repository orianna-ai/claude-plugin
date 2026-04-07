import { Fragment } from "react";
import { Text } from "@radix-ui/themes";

import type { GatherContextMessage } from "../../api.ts";

import { ReasoningSummaryBlock } from "./ReasoningSummaryBlock.tsx";
import { TypedTextBlock } from "./TypedTextBlock.tsx";

import "./GatherContextMessageBlock.css";

export function GatherContextMessageBlock({
  isSidePanelVisible,
  message,
}: {
  isSidePanelVisible: boolean;
  message: GatherContextMessage;
}) {
  const hasReply = message.reply !== undefined && message.reply !== "";

  return (
    <Fragment>
      <ReasoningSummaryBlock
        isReasoning={!hasReply}
        isSidePanelVisible={isSidePanelVisible}
        reasoningSummaries={message.reply_reasoning_summaries}
      />
      {hasReply && (
        <Text as="div" className="gather-context-message-paragraph">
          <TypedTextBlock text={message.reply ?? ""} />
        </Text>
      )}
    </Fragment>
  );
}
