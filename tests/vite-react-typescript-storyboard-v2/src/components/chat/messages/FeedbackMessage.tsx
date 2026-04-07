import { useMemo, useState } from "react";

import { ChatBubbleIcon } from "../../../icons";
import { ChevronDownIcon } from "../../../icons";
import type { Comment } from "../../../api/types.gen";

import "./FeedbackMessage.css";

type Props = {
  comments: Comment[];
};

function FeedbackMessage({ comments }: Props) {
  const [expanded, setExpanded] = useState(false);
  const orderedComments = useMemo(() => [...comments].reverse(), [comments]);

  if (comments.length === 0) {
    return null;
  }

  const visibleItems = orderedComments.slice(0, 3);
  const hiddenItems = orderedComments.slice(3);

  const renderItem = (comment: Comment) => (
    <button
      key={comment.id}
      type="button"
      className="feedback-message-item"
      onClick={() => {
        window.dispatchEvent(
          new CustomEvent("focus-comment", { detail: { id: comment.id } }),
        );
      }}
    >
      <ChatBubbleIcon className="feedback-message-item-icon" size={16} />
      <span>{comment.message.text}</span>
    </button>
  );

  return (
    <div className="feedback-message">
      <div className="feedback-message-container">
        <div className="feedback-message-header">
          <span className="feedback-message-title">My feedback</span>
          <span className="feedback-message-count">
            {comments.length} todo{comments.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="feedback-message-items">
          {visibleItems.map(renderItem)}
        </div>
        {hiddenItems.length > 0 && (
          <>
            <div
              className={`feedback-message-more${expanded ? " feedback-message-more-open" : ""}`}
            >
              <div className="feedback-message-more-inner">
                {hiddenItems.map(renderItem)}
              </div>
            </div>
            <button
              className={`feedback-message-more-toggle${expanded ? " feedback-message-more-toggle-open" : ""}`}
              onClick={() => setExpanded(!expanded)}
            >
              <span>{expanded ? "See less" : "More"}</span>
              <ChevronDownIcon size={12} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default FeedbackMessage;
