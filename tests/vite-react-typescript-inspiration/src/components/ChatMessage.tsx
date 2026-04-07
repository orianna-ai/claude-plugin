import type { Message } from "../useChat.ts";

import { DriveConversationMessageBlock } from "./blocks/DriveConversationMessageBlock.tsx";
import { ErrorMessageBlock } from "./blocks/ErrorMessageBlock.tsx";
import { GatherContextMessageBlock } from "./blocks/GatherContextMessageBlock.tsx";
import { GenerateMockMessageBlock } from "./blocks/GenerateMockMessageBlock.tsx";
import { RerankInspirationMessageBlock } from "./blocks/RerankInspirationMessageBlock.tsx";
import { UserMessageBlock } from "./blocks/UserMessageBlock.tsx";

export function ChatMessage({
  message,
  isSidePanelVisible,
  setSidePanelContent,
}: {
  message: Message;
  isSidePanelVisible: boolean;
  setSidePanelContent: (node: React.ReactNode | null) => void;
}) {
  if (message.type === "error_message") {
    return <ErrorMessageBlock message={message} />;
  } else if (message.type === "user_message") {
    return <UserMessageBlock message={message} />;
  } else if (message.type === "gather_context_message") {
    return (
      <GatherContextMessageBlock
        isSidePanelVisible={isSidePanelVisible}
        message={message}
      />
    );
  } else if (message.type === "drive_conversation_message") {
    return (
      <DriveConversationMessageBlock
        isSidePanelVisible={isSidePanelVisible}
        message={message}
      />
    );
  } else if (message.type === "rerank_inspiration_message") {
    return (
      <RerankInspirationMessageBlock
        isSidePanelVisible={isSidePanelVisible}
        message={message}
        setSidePanelContent={setSidePanelContent}
      />
    );
  } else if (message.type == "generate_mock_message") {
    return <GenerateMockMessageBlock message={message} />;
  } else {
    return null;
  }
}
