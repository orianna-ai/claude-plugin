import { type JSX, useCallback, useEffect, useRef, useState } from "react";
import ScrollToBottom from "react-scroll-to-bottom";
import { Flex } from "@radix-ui/themes";

import type { Conversation, UserMessage } from "../api.ts";

import { ImageGalleryBlock } from "./blocks/ImageGalleryBlock.tsx";
import { ReasoningSummaryBlock } from "./blocks/ReasoningSummaryBlock.tsx";
import { ChatInput } from "./ChatInput.tsx";
import { ChatMessage } from "./ChatMessage.tsx";

import "./ChatPage.css";

export function ChatPage({
  canQueueMessages,
  conversation,
  isResponding,
  messageQueue,
  sendMessage,
}: {
  canQueueMessages: boolean;
  conversation: Conversation;
  isResponding: boolean;
  messageQueue: Conversation;
  sendMessage: (message: UserMessage) => void;
}): JSX.Element {
  const [sidePanelContent, setSidePanelContent] =
    useState<React.ReactNode | null>(null);
  const [mainWidth, setMainWidth] = useState<number>(400);
  const dragStartXRef = useRef<number | null>(null);
  const dragStartWidthRef = useRef<number>(400);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sidePanelContent) {
      setMainWidth(550);
    } else {
      setMainWidth((w) => Math.max(280, Math.min(400, w || 400)));
    }
  }, [sidePanelContent]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (dragStartXRef.current == null) return;
      e.preventDefault();
      const delta = e.clientX - dragStartXRef.current;
      const next = Math.max(
        280,
        Math.min(400, dragStartWidthRef.current + delta),
      );
      setMainWidth(next);
    };

    const onMouseUp = () => {
      dragStartXRef.current = null;
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  const handleSendMessage = useCallback(
    (message: UserMessage) => {
      sendMessage(message);

      if (!sidePanelContent) {
        setSidePanelContent(<ImageGalleryBlock />);
      }

      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      }, 0);
    },
    [sendMessage, sidePanelContent],
  );

  return (
    <div
      className={`chat-page ${sidePanelContent ? "chat-page-side-panel-visible" : ""}`}
    >
      <div
        className="chat-page-main"
        style={
          sidePanelContent ? { width: mainWidth, flex: "0 0 auto" } : undefined
        }
      >
        <ScrollToBottom
          className="chat-page-messages"
          followButtonClassName="chat-page-messages-follow"
          mode="bottom"
          initialScrollBehavior="auto"
        >
          <Flex
            direction="column"
            gap="6"
            aria-live="polite"
            align="stretch"
            width="100%"
          >
            <div className="chat-page-spacer-top" />
            {conversation.messages.map((message) => (
              <ChatMessage
                isSidePanelVisible={!!sidePanelContent}
                key={message.id}
                message={message}
                setSidePanelContent={setSidePanelContent}
              />
            ))}
            {messageQueue.messages.map((message) => (
              <ChatMessage
                isSidePanelVisible={!!sidePanelContent}
                key={message.id}
                message={message}
                setSidePanelContent={setSidePanelContent}
              />
            ))}
            {messageQueue.messages.length > 0 && (
              <ReasoningSummaryBlock
                isSidePanelVisible={!!sidePanelContent}
                isReasoning={true}
              />
            )}
            <div className="chat-page-spacer-bottom" ref={bottomRef} />
          </Flex>
        </ScrollToBottom>
        <ChatInput
          canQueueMessages={canQueueMessages}
          isResponding={isResponding}
          sendMessage={handleSendMessage}
        />
      </div>
      {sidePanelContent && (
        <>
          <div
            className="chat-page-resizer"
            onMouseDown={(e) => {
              dragStartXRef.current = e.clientX;
              dragStartWidthRef.current = mainWidth;
              document.body.style.userSelect = "none";
            }}
          />
          <div className="chat-page-side-panel">{sidePanelContent}</div>
        </>
      )}
    </div>
  );
}
