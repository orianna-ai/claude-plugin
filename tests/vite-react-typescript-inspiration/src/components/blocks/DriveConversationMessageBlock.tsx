import { Fragment } from "react";
import { Text } from "@radix-ui/themes";

import type { DriveConversationMessage } from "../../api.ts";

import { ReasoningSummaryBlock } from "./ReasoningSummaryBlock.tsx";
import { TypedTextBlock } from "./TypedTextBlock.tsx";

import "./DriveConversationMessageBlock.css";

export function DriveConversationMessageBlock({
  isSidePanelVisible,
  message,
}: {
  isSidePanelVisible: boolean;
  message: DriveConversationMessage;
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
        <Text as="div" className="drive-conversation-message-paragraph">
          <TypedTextBlock text={message.reply ?? ""} />
        </Text>
      )}
    </Fragment>
  );
}
