import { FC, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";

import { ChatBubbleIcon, SparklesIcon, TypeIcon } from "../../icons";
import type { ElementOutput as Element } from "../../api/types.gen";
import { DESCRIPTION_HEIGHT } from "../../api/layout";
import { useCanvasMode } from "../../hooks/useCanvasMode";
import { useHistory } from "../../hooks/useHistory";
import { useLayout } from "../../hooks/useLayout";

import "./EmptyCanvasOverlay.css";

// Constants for new elements (same as Canvas.tsx)
// user-created text elements start in auto-width mode (0 = auto-width)
const TEXT_ELEMENT_WIDTH = 0;
const TEXT_ELEMENT_HEIGHT = DESCRIPTION_HEIGHT;

// Default position for new elements (centered area)
const DEFAULT_X = 250;
const DEFAULT_Y = 100;

interface EmptyCanvasOverlayProps {
  visible: boolean;
}

const EmptyCanvasOverlay: FC<EmptyCanvasOverlayProps> = ({ visible }) => {
  const { setMode } = useCanvasMode();
  const { commitBeforeChange } = useHistory();
  const { updateElements } = useLayout();

  const handleCommentClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();

      // Switch to comment mode
      setMode("comment");

      // Dispatch event for Canvas to create a comment at viewport center
      // This ensures the full comment creation flow (including screenshot) is used
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("create-comment-at-center"));
      }, 50);
    },
    [setMode],
  );

  const handleCanvasClick = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();

      // Commit state before creating text so undo will remove the new element
      commitBeforeChange();

      // Create a new text element at the default position
      // The TextNode component will auto-enter edit mode for new text-* elements with "Text" content
      const textId = `text-${uuidv4()}`;
      const textElement: Element = {
        slot: {
          id: textId,
          content_type: "text",
          description: { type: "text", text: "" },
          height: TEXT_ELEMENT_HEIGHT,
          width: TEXT_ELEMENT_WIDTH,
          x: DEFAULT_X,
          y: DEFAULT_Y,
          source: "user",
        },
        content: {
          type: "text",
          text: "Text",
        },
      };

      // Switch to select mode so user can interact with the element
      setMode("select");

      // Create the element - TextNode will auto-enter edit mode and select the text
      await updateElements([textElement]);

      // Select the newly created element in ReactFlow
      // Dispatch event that Canvas listens for to select the node
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("select-node", { detail: { id: textId } }),
        );
      }, 50);
    },
    [commitBeforeChange, updateElements, setMode],
  );

  if (!visible) return null;

  return (
    <div className="empty-canvas-overlay" onClick={(e) => e.stopPropagation()}>
      <div className="empty-canvas-overlay-prompt">
        <SparklesIcon className="empty-canvas-overlay-prompt-icon" />
        <span>
          To generate mocks, write your design problem and add an image...
        </span>
      </div>
      <div className="empty-canvas-overlay-pills">
        <button
          className="empty-canvas-overlay-button"
          type="button"
          onClick={handleCommentClick}
        >
          <ChatBubbleIcon size={18} className="empty-canvas-overlay-icon" />
          <span className="empty-canvas-overlay-text">In a comment</span>
        </button>
        <button
          className="empty-canvas-overlay-button"
          type="button"
          onClick={handleCanvasClick}
        >
          <TypeIcon size={18} className="empty-canvas-overlay-icon" />
          <span className="empty-canvas-overlay-text">On the canvas</span>
        </button>
      </div>
    </div>
  );
};

export default EmptyCanvasOverlay;
