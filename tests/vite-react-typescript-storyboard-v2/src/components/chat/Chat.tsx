import { JSX, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ChatBubbleIcon } from "../../icons";
import { CheckIcon } from "../../icons";
import { ChevronDownIcon } from "../../icons";
import { MenuIcon } from "../../icons";
import { MOCK_DELAY_MS } from "../../constants/mockDelays";
import { Agent, useAgent } from "../../hooks/useAgent";
import { Design, useDesigns } from "../../hooks/useDesigns";
import { useLayout } from "../../hooks/useLayout";
import { sanitizeElements } from "../../utils/sanitizeElements";
import {
  registerPickerOpenListener,
  toggleDesignPicker,
} from "../design-picker/designPickerState";

import AssistantMessage from "./messages/AssistantMessage";
import DesignSection from "./messages/DesignSection";
import ErrorMessage from "./messages/ErrorMessage";
import FeedbackMessage from "./messages/FeedbackMessage";
import UserMessage from "./messages/UserMessage";

import "./Chat.css";

function Chat() {
  const {
    agent,
    isResponding,
    sendRequest,
    currentRequest,
    cancelAllRequests,
  } = useAgent();

  const { currentDesign } = useDesigns();

  const { layout, updateComments } = useLayout();

  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!isResponding) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [isResponding]);

  const handleCancelClick = useCallback(() => {
    cancelAllRequests();
  }, [cancelAllRequests]);

  const messages = useMemo(
    () =>
      getMessages({
        agent,
        design: currentDesign,
        isResponding,
        now,
        requestStartTime: currentRequest?.createdAt
          ? new Date(currentRequest.createdAt).getTime()
          : undefined,
      }),
    [agent, currentDesign, isResponding, now, currentRequest?.createdAt],
  );

  const showPendingDesign = useMemo(() => {
    if (!isResponding) return false;
    const lastResponse = [...agent.history]
      .reverse()
      .find((e) => e.type === "generate_revision_agent_response");
    if (
      !lastResponse ||
      lastResponse.type !== "generate_revision_agent_response"
    )
      return true;
    return (
      !lastResponse.slots_reasoning ||
      Object.keys(lastResponse.slots_reasoning).length === 0
    );
  }, [isResponding, agent.history]);

  const feedback = useMemo(
    () => layout.comments.filter((c) => !c.is_deleted),
    [layout.comments],
  );

  const hasFinalImage = useMemo(() => {
    const lastResponse = [...agent.history]
      .reverse()
      .find((e) => e.type === "generate_revision_agent_response");

    if (
      !lastResponse ||
      lastResponse.type !== "generate_revision_agent_response"
    ) {
      return false;
    }

    const elements = lastResponse.elements ?? {};
    return Object.values(elements).some(
      (el) => el.content?.type === "image" && !el.content.is_preview,
    );
  }, [agent.history]);

  const handleSubmit = useCallback(async () => {
    if (!currentDesign) {
      return;
    }

    try {
      window.dispatchEvent(new CustomEvent("focus-new-design"));

      sendRequest({
        type: "generate_revision_agent_request",
        problem: currentDesign.problem,
        elements: sanitizeElements([...layout.elements]),
        comments: feedback,
      });

      await updateComments(
        ...feedback.map((c) => ({ id: c.id, is_submitted: true })),
      );
    } catch (error) {
      console.error("Error in handleSubmit:", error);
    }
  }, [currentDesign, feedback, layout.elements, sendRequest, updateComments]);

  const canSubmit = feedback.some((c) => !c.is_submitted && !c.is_editable);

  const canDesign = !isResponding || hasFinalImage;
  const canDesignNextRev = canSubmit && canDesign;

  useEffect(() => {
    if (!canDesignNextRev) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canDesignNextRev, handleSubmit]);

  const title = currentDesign?.title ?? "New canvas";

  const [linkCopied, setLinkCopied] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [feedbackExpanded, setFeedbackExpanded] = useState(false);

  const messagesRef = useRef<HTMLDivElement>(null);

  const [showExtraScrollSpace, setShowExtraScrollSpace] = useState(false);
  const wasRespondingRef = useRef(false);

  useEffect(() => {
    if (isResponding && !wasRespondingRef.current) {
      setShowExtraScrollSpace(true);
      requestAnimationFrame(() => {
        if (messagesRef.current) {
          messagesRef.current.scrollTo({
            top: messagesRef.current.scrollHeight,
            behavior: "smooth",
          });
        }
      });
    }
    wasRespondingRef.current = isResponding;
  }, [isResponding]);

  useEffect(() => {
    return registerPickerOpenListener(setPickerOpen);
  }, []);

  const handleShare = useCallback(() => {
    navigator.clipboard.writeText(window.location.href);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 3000);
  }, []);

  return (
    <div className="chat">
      <div className="chat-header">
        <button
          className={`chat-header-toggle${pickerOpen ? " open" : ""}`}
          onClick={toggleDesignPicker}
          aria-label="Toggle design picker"
        >
          <MenuIcon size={20} />
        </button>
        <span className="chat-header-title">{title}</span>
        <button
          className={`chat-header-share${linkCopied ? " copied" : ""}`}
          onClick={handleShare}
        >
          {linkCopied ? (
            <>
              <CheckIcon size={16} strokeWidth={3} color="#627532" />
              Copied link
            </>
          ) : (
            "Share"
          )}
        </button>
      </div>
      <div className="chat-messages" ref={messagesRef}>
        {messages}
        {showPendingDesign && (
          <div className="design-section design-section-pending">
            <span className="design-section-pending-title">
              Designing · 60-90s
            </span>
            <button
              className="design-section-stop-text"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleCancelClick();
              }}
            >
              Stop
            </button>
          </div>
        )}
        {showExtraScrollSpace && (
          <div className="chat-messages-scroll-spacer" aria-hidden="true" />
        )}
      </div>
      <div className="chat-actions">
        {feedback.some((c) => !c.is_submitted && !c.is_editable) ? (
          <>
            <div className="chat-feedback">
              <div className="chat-feedback-header">
                <span className="chat-feedback-title">My feedback</span>
                <span className="chat-feedback-count">
                  {
                    feedback.filter((c) => !c.is_submitted && !c.is_editable)
                      .length
                  }{" "}
                  todos
                </span>
              </div>
              {(() => {
                const items = [...feedback]
                  .filter((c) => !c.is_submitted && !c.is_editable)
                  .reverse();
                const visibleItems = items.slice(0, 3);
                const hiddenItems = items.slice(3);

                const renderItem = (comment: (typeof items)[0]) => (
                  <button
                    key={comment.id}
                    className="chat-feedback-item"
                    onClick={() => {
                      window.dispatchEvent(
                        new CustomEvent("focus-comment", {
                          detail: { id: comment.id },
                        }),
                      );
                    }}
                  >
                    <ChatBubbleIcon
                      size={16}
                      className="chat-feedback-item-icon"
                      aria-hidden="true"
                    />
                    <span>{comment.message.text}</span>
                  </button>
                );

                return (
                  <>
                    <div className="chat-feedback-items">
                      {visibleItems.map(renderItem)}
                    </div>
                    {hiddenItems.length > 0 && (
                      <>
                        <div
                          className={`chat-feedback-more${feedbackExpanded ? " chat-feedback-more-open" : ""}`}
                        >
                          <div className="chat-feedback-more-inner">
                            {hiddenItems.map(renderItem)}
                          </div>
                        </div>
                        <button
                          className={`chat-feedback-more-toggle${feedbackExpanded ? " chat-feedback-more-toggle-open" : ""}`}
                          onClick={() => setFeedbackExpanded(!feedbackExpanded)}
                        >
                          <span>{feedbackExpanded ? "See less" : "More"}</span>
                          <ChevronDownIcon size={12} />
                        </button>
                      </>
                    )}
                  </>
                );
              })()}
            </div>
            {canDesignNextRev && (
              <button
                className="chat-action-design"
                type="button"
                onClick={handleSubmit}
              >
                <span className="chat-action-design-text">Design next rev</span>
                <span className="chat-action-design-shortcut">⌘+Enter</span>
              </button>
            )}
          </>
        ) : (
          <div className="chat-empty">
            <ChatBubbleIcon
              size={16}
              className="chat-empty-icon"
              aria-hidden="true"
            />
            <span>Click on the canvas to chat</span>
          </div>
        )}
      </div>
    </div>
  );
}

function getMessages({
  agent,
  design,
  isResponding,
  now,
  requestStartTime,
}: {
  agent: Agent;
  design?: Design;
  isResponding: boolean;
  now: number;
  requestStartTime?: number;
}): JSX.Element[] {
  const messages: JSX.Element[] = [];

  if (design) {
    messages.push(<UserMessage key={"problem"} content={design.problem} />);
  }

  const _lastResponseEvent = [...agent.history]
    .reverse()
    .find((e) => e.type === "generate_revision_agent_response");

  for (const event of agent.history) {
    if (event.type === "generate_revision_agent_request") {
      const comments = (event.comments ?? []).filter(
        (c) => !c.is_submitted && !c.is_editable,
      );
      if (comments.length > 0) {
        messages.push(
          <FeedbackMessage
            key={`${event.id ?? "unknown"}-feedback`}
            comments={comments}
          />,
        );
      }
    } else if (
      event.type === "generate_revision_agent_response" ||
      event.type === "retry_content_agent_response"
    ) {
      const hasSlotsReasoning =
        event.type === "generate_revision_agent_response" &&
        event.slots_reasoning &&
        Object.keys(event.slots_reasoning).length > 0;
      const hasElementsReasoning =
        event.elements_reasoning &&
        Object.keys(event.elements_reasoning).length > 0;
      const isDesignComplete = !!(
        event.slots &&
        Object.keys(event.slots).length > 0 &&
        event.elements &&
        Object.keys(event.elements).length === Object.keys(event.slots).length
      );

      if (hasSlotsReasoning || hasElementsReasoning) {
        messages.push(
          <DesignSection
            key={`${event.id ?? "unknown"}-design-section`}
            eventId={event.id ?? "unknown"}
            slotsReasoning={
              event.type === "generate_revision_agent_response"
                ? event.slots_reasoning
                : undefined
            }
            elementsReasoning={event.elements_reasoning}
            isComplete={isDesignComplete}
            isResponding={isResponding}
            requestStartTime={requestStartTime}
          />,
        );
      }

      const isReasoningDelayed = (r: {
        created_at?: string | null;
        completed_at?: string | null;
      }) => {
        if (r.completed_at) return false;
        if (!r.created_at) return false;
        const created = new Date(r.created_at).getTime();
        return now - created > MOCK_DELAY_MS;
      };

      const allSlotsReasoningComplete =
        event.type === "generate_revision_agent_response" &&
        event.slots_reasoning &&
        Object.values(event.slots_reasoning).every((r) => r.completed_at);
      const allElementsReasoningComplete =
        event.elements_reasoning &&
        Object.keys(event.elements_reasoning).length > 0 &&
        Object.values(event.elements_reasoning).every(
          (r) => r.completed_at || isReasoningDelayed(r),
        );
      const isReasoningComplete =
        allSlotsReasoningComplete && allElementsReasoningComplete;

      const shouldShowDescription = isReasoningComplete;

      if (shouldShowDescription && event.elements) {
        const descriptionElement = Object.values(event.elements).find(
          (el) => el.content?.type === "text" && el.content?.variant === "p",
        );
        const descriptionText =
          descriptionElement?.content?.type === "text"
            ? descriptionElement.content.text
            : null;

        if (descriptionText) {
          messages.push(
            <AssistantMessage
              key={`${event.id}-description`}
              message={descriptionText}
            />,
          );
        }
      }
    } else if (event.type === "error_agent_response") {
      messages.push(<ErrorMessage key={`${event.id}-error`} error={event} />);
    }
  }

  return messages;
}

export default Chat;
