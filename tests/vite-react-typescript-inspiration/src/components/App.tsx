import { useEffect } from "react";

import { useChat } from "../useChat.ts";

import { ChatPage } from "./ChatPage.tsx";
import { LandingPage } from "./LandingPage.tsx";
import { UserIdentity } from "./UserIdentity.tsx";

import "./App.css";

export function App() {
  const {
    canQueueMessages,
    conversation,
    isResponding,
    messageQueue,
    sendMessage,
  } = useChat({});

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const text = params.get("text");
    const imagesParam = params.get("images");

    if (text) {
      let imageUrls: string[] = [];
      if (imagesParam) {
        try {
          imageUrls = JSON.parse(imagesParam);
        } catch (e) {
          console.error("Failed to parse images:", e);
        }
      }

      sendMessage({
        id: crypto.randomUUID(),
        type: "user_message",
        text,
        image_urls: imageUrls,
      });

      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [sendMessage]);

  return (
    <div className="app-root">
      <UserIdentity />
      {conversation.messages.length === 0 ? (
        <LandingPage sendMessage={sendMessage} />
      ) : (
        <ChatPage
          canQueueMessages={canQueueMessages}
          conversation={conversation}
          isResponding={isResponding}
          messageQueue={messageQueue}
          sendMessage={sendMessage}
        />
      )}
    </div>
  );
}
