import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import readNDJSONStream from "ndjson-readablestream";

import type { Conversation } from "./api.ts";
import { handleMockChat } from "./mock-backend.ts";

export type Message = Conversation["messages"][number];

interface UseChatOptions {
  baseUrl?: string;
  initialConversation?: Conversation;
}

interface UseChatResult {
  conversation: Readonly<Conversation>;
  canQueueMessages: boolean;
  isResponding: boolean;
  messageQueue: Readonly<Conversation>;
  sendMessage: (message: Message) => void;
  stopResponding: () => void;
}

export function useChat({
  initialConversation = { messages: [] },
}: UseChatOptions): UseChatResult {
  const [conversation, setConversation] =
    useState<Conversation>(initialConversation);

  const [messageQueue, setMessageQueue] = useState<Conversation>({
    messages: [],
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const { isPending, mutate } = useMutation<void, Error, Conversation>({
    mutationFn: async (conversation: Conversation): Promise<void> => {
      try {
        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        const { readable, writable } = new TransformStream<Uint8Array>();
        const writer = writable.getWriter();

        handleMockChat(conversation, writer);

        for await (const message of readNDJSONStream(
          readable,
        ) as AsyncIterable<Message>) {
          if (abortController.signal.aborted) break;
          if (message.type !== "heartbeat_message") {
            setConversation((prev) => {
              const i = prev.messages.findIndex((m) => m.id === message.id);
              if (i === -1) {
                return { ...prev, messages: [...prev.messages, message] };
              } else {
                const next = [...prev.messages];
                next[i] = message;
                return { ...prev, messages: next };
              }
            });
          }
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setConversation((prev) => {
          return {
            messages: [
              ...prev.messages,
              {
                type: "error_message",
                summary:
                  error instanceof Error
                    ? `${error.name}: ${error.message}`
                    : String(error),
                stack_trace: error instanceof Error ? error.stack : undefined,
              },
            ],
          };
        });
      }
    },
    onSettled: () => {
      abortControllerRef.current = null;
    },
  });

  const stopResponding = useCallback((): void => {
    abortControllerRef.current?.abort();
  }, []);

  const sendMessage = useCallback(
    (message: Message): void => {
      if (isPending) {
        setMessageQueue((prev) => ({ messages: [...prev.messages, message] }));
      } else {
        setConversation((prev) => {
          const nextConversation = { messages: [...prev.messages, message] };
          mutate(nextConversation);
          return nextConversation;
        });
      }
    },
    [isPending, mutate],
  );

  useEffect(() => {
    if (!isPending && messageQueue.messages.length > 0) {
      setConversation((prev) => {
        const nextConversation = {
          messages: [...prev.messages, ...messageQueue.messages],
        };
        mutate(nextConversation);
        return nextConversation;
      });
      setMessageQueue({ messages: [] });
    }
  }, [isPending, mutate, messageQueue]);

  const canQueueMessages =
    conversation.messages.filter((m) => m.type === "user_message").length ===
      1 &&
    conversation.messages.filter(
      (m) =>
        m.type === "gather_context_message" &&
        ((m.reply?.length ?? 0) > 0),
    ).length === 1 &&
    messageQueue.messages.length === 0;

  return {
    canQueueMessages,
    conversation,
    isResponding: isPending,
    messageQueue,
    sendMessage,
    stopResponding,
  };
}
