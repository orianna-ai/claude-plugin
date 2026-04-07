import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Flex, Text, TextArea } from "@radix-ui/themes";
import { v4 as uuidv4 } from "uuid";

import { ArrowUpIcon, PlusIcon, XIcon } from "../icons.tsx";
import type { UserMessage } from "../api.ts";

import "./ChatInput.css";

export function ChatInput({
  canQueueMessages,
  isResponding,
  sendMessage,
}: {
  canQueueMessages: boolean;
  isResponding: boolean;
  sendMessage: (message: UserMessage) => void;
}) {
  const [text, setText] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);

  const hasContent = useMemo(
    () => text.trim().length > 0 || imageUrls.length > 0,
    [text, imageUrls],
  );

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files);
    const readers = await Promise.all(
      arr
        .filter((f) => f.type.startsWith("image/"))
        .map(
          (file) =>
            new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result));
              reader.onerror = () => reject(reader.error);
              reader.readAsDataURL(file);
            }),
        ),
    );
    setImageUrls((prev) => [...prev, ...readers]);
  }, []);

  const onPaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      if (!e.clipboardData) return;
      const items = e.clipboardData.files;
      if (items && items.length > 0) {
        e.preventDefault();
        handleFiles(items);
      }
    },
    [handleFiles],
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles],
  );

  const onSubmit = useCallback(() => {
    if (hasContent) {
      sendMessage({
        id: uuidv4().toString(),
        type: "user_message",
        text,
        image_urls: imageUrls,
      });
      setText("");
      setImageUrls([]);
    }
  }, [hasContent, sendMessage, text, imageUrls]);

  const autoResize = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  const canSendMessage = hasContent && (!isResponding || canQueueMessages);

  useEffect(() => {
    autoResize(textAreaRef.current);
  }, [text, autoResize]);

  return (
    <Flex
      direction="column"
      className="chat-input"
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      {canQueueMessages && (
        <div className="chat-input-banner">
          Answer the above questions to see inspiration.
        </div>
      )}
      <Flex direction="column" className="chat-input-content">
        <TextArea
          value={text}
          placeholder="Write a reply..."
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();

              if (canSendMessage) {
                onSubmit();
              }
            }
          }}
          onInput={(e) => autoResize(e.currentTarget)}
          onPaste={onPaste}
          rows={1}
          resize="none"
          ref={textAreaRef}
        />
        <Flex justify="between" align="center">
          <Button
            type="button"
            className="chat-input-add"
            onClick={() => fileInputRef.current?.click()}
          >
            <PlusIcon size={16} />
            <Text weight={"bold"}>{"Add screenshots"}</Text>
          </Button>
          <Button
            className={`chat-input-send ${canSendMessage ? "chat-input-send-enabled" : ""}`}
            disabled={!canSendMessage}
            onClick={onSubmit}
            aria-label={"Send Message"}
          >
            <ArrowUpIcon size={16} />
          </Button>
        </Flex>
      </Flex>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />
      {imageUrls.length > 0 && (
        <Flex className="chat-input-images">
          {imageUrls.map((src, i) => (
            <div className="chat-input-image" key={i}>
              <img src={src} alt="preview" />
              <button
                type="button"
                className="chat-input-remove-image"
                onClick={() =>
                  setImageUrls((prev) => prev.filter((_, idx) => idx !== i))
                }
                aria-label="Remove Image"
              >
                <XIcon size={16} />
              </button>
            </div>
          ))}
        </Flex>
      )}
    </Flex>
  );
}
