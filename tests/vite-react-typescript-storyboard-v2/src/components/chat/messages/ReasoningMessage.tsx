import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { ChevronDownIcon } from "../../../icons";
import { CompassIcon } from "../../../icons";
import { PaintbrushIcon } from "../../../icons";
import type { Reasoning } from "../../../api/types.gen";

import "./ReasoningMessage.css";

type Props = {
  reasoning: Reasoning;
  variant?: "default" | "design";
  autoOpen?: boolean;
  autoCloseOnComplete?: boolean;
  disableInteraction?: boolean;
  hideChevron?: boolean;
  isDelayed?: boolean;
};

function ReasoningMessage({
  reasoning,
  variant = "default",
  autoOpen = false,
  autoCloseOnComplete = false,
  disableInteraction = false,
  hideChevron = false,
  isDelayed = false,
}: Props) {
  const [isOpen, setIsOpen] = useState(autoOpen);
  const bodyInnerRef = useRef<HTMLDivElement | null>(null);
  const prevKeyRef = useRef<string>("");
  const prevBodyRef = useRef<string>("");
  const prevParagraphCountRef = useRef<number>(0);
  const [animateRange, setAnimateRange] = useState<{
    start: number;
    count: number;
  } | null>(null);

  useEffect(() => {
    if (autoOpen) {
      setIsOpen(true);
    }
  }, [autoOpen]);

  useEffect(() => {
    if (autoCloseOnComplete && reasoning.completed_at) {
      setIsOpen(false);
    }
  }, [autoCloseOnComplete, reasoning.completed_at]);

  const title = useMemo(() => {
    if (variant === "default") {
      return "Planning...";
    }

    if (reasoning.created_at && reasoning.completed_at) {
      const completedAt = new Date(reasoning.completed_at).getTime();
      const createdAt = new Date(reasoning.created_at).getTime();
      const duration = Math.round((completedAt - createdAt) / 1000);
      const minutes = Math.floor(duration / 60);
      const seconds = duration % 60;

      if (minutes > 0) {
        return `Mocked in ${minutes}m ${seconds}s`;
      } else {
        return `Mocked in ${seconds}s`;
      }
    }

    if (isDelayed) {
      return "Mock on the way...";
    }
    return "Mocking...";
  }, [reasoning.created_at, reasoning.completed_at, variant, isDelayed]);

  const paragraphs = useMemo(() => {
    const allText = Object.entries(reasoning.summaries ?? {})
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
      .map(([_, v]) => v)
      .join("\n");

    return allText
      .split(/\*\*[^*]+\*\*/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  }, [reasoning.summaries]);

  const reasoningKey = useMemo(
    () =>
      reasoning.completed_at ?? reasoning.created_at ?? paragraphs.join("||"),
    [paragraphs, reasoning.completed_at, reasoning.created_at],
  );

  const isDone =
    variant === "design" && (!!reasoning.completed_at || isDelayed);

  useLayoutEffect(() => {
    const currentLength = paragraphs.length;
    const prevLength = prevParagraphCountRef.current;
    const prevKey = prevKeyRef.current;
    const hasNewKey = reasoningKey !== prevKey;
    const hasNewParagraphs = currentLength > prevLength;

    prevParagraphCountRef.current = currentLength;
    prevKeyRef.current = reasoningKey;

    if (!hasNewKey && !hasNewParagraphs) {
      setAnimateRange(null);
      return;
    }

    const start = hasNewKey ? 0 : prevLength;
    const count = hasNewKey ? currentLength : currentLength - prevLength;

    if (count <= 0) {
      setAnimateRange(null);
      return;
    }

    setAnimateRange({ start, count });

    const totalDuration = count * 60 + 240;
    const timeout = window.setTimeout(
      () => setAnimateRange(null),
      totalDuration,
    );

    return () => {
      window.clearTimeout(timeout);
    };
  }, [paragraphs.length, reasoningKey]);

  useEffect(() => {
    if (!isOpen) return;
    if (!bodyInnerRef.current) return;

    bodyInnerRef.current.scrollTo({
      top: bodyInnerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [isOpen, paragraphs.length]);

  useEffect(() => {
    const current = paragraphs.join(" | ");
    const previous = prevBodyRef.current;
    const hasNewContent = current !== previous;

    if (!hasNewContent) return;
    prevBodyRef.current = current;

    if (isOpen && bodyInnerRef.current) {
      requestAnimationFrame(() => {
        bodyInnerRef.current?.scrollTo({
          top: bodyInnerRef.current.scrollHeight,
          behavior: "smooth",
        });
      });
    }
  }, [paragraphs, isOpen]);

  return (
    <div
      className={`reasoning-message${isDone ? " done" : ""}${isOpen ? " open" : ""}`}
    >
      <div
        className={`reasoning-message-header${disableInteraction ? " disabled" : ""}`}
        onClick={() => {
          if (disableInteraction) return;
          setIsOpen(!isOpen);
        }}
      >
        <span
          className={`reasoning-message-icon${variant === "default" ? " reasoning-message-icon-spin" : ""}${variant === "design" && !isDone ? " reasoning-message-icon-sweep" : ""}`}
        >
          {variant === "design" ? (
            <PaintbrushIcon size={14} />
          ) : (
            <CompassIcon size={14} />
          )}
        </span>
        <span className="reasoning-message-title-container">
          {isDone ? (
            <span className="reasoning-message-title">{title}</span>
          ) : (
            <span className="reasoning-message-title-wrapper">
              <span className="reasoning-message-title-shimmer">{title}</span>
              <span className="reasoning-message-title-overlay">{title}</span>
            </span>
          )}
        </span>
        {!hideChevron && (
          <span className="reasoning-message-chevron">
            <ChevronDownIcon size={12} />
          </span>
        )}
      </div>
      {paragraphs.length > 0 && (
        <div
          className={`reasoning-message-body${isOpen ? " reasoning-message-body-open" : ""}`}
        >
          <div className="reasoning-message-body-inner" ref={bodyInnerRef}>
            {paragraphs.map((text, paragraphIndex) => {
              return (
                <div
                  className={`reasoning-message-line${
                    animateRange &&
                    paragraphIndex >= animateRange.start &&
                    paragraphIndex < animateRange.start + animateRange.count
                      ? " reasoning-message-line-animate"
                      : ""
                  }`}
                  style={
                    animateRange &&
                    paragraphIndex >= animateRange.start &&
                    paragraphIndex < animateRange.start + animateRange.count
                      ? {
                          animationDelay: `${(paragraphIndex - animateRange.start) * 120}ms`,
                        }
                      : undefined
                  }
                  key={`paragraph-${paragraphIndex}`}
                >
                  {text}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default ReasoningMessage;
