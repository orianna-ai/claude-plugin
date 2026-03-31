import { FC } from "react";
import { useStore } from "reactflow";

import { useLayout } from "../../hooks/useLayout";

import { useCanvasContext } from "./CanvasContext";

// Fixed line length in canvas units
const LINE_LENGTH = 2000;
const LINE_COLOR = "#627532";
// Vertical offset below the comment point
const VERTICAL_OFFSET = 80;
// Height of the end cap lines (just slightly taller than stroke width)
const END_CAP_HEIGHT = 5;

/**
 * Renders a simple fixed-length line from a comment when hovered/selected.
 * The line extends horizontally to the right with perpendicular end caps.
 */
const GroupConnectorLines: FC = () => {
  const { activeGroupNodeId } = useCanvasContext();
  const { layout } = useLayout();
  const transform = useStore((s) => s.transform);
  const zoom = transform[2];

  // Get real-time position from nodeInternals (updates during drag)
  const nodeX = useStore(
    (s) => s.nodeInternals.get(activeGroupNodeId ?? "")?.position.x,
  );
  const nodeY = useStore(
    (s) => s.nodeInternals.get(activeGroupNodeId ?? "")?.position.y,
  );

  // Find the active comment for fallback position
  const activeComment = layout.comments.find(
    (c) => c.id === activeGroupNodeId && !c.is_deleted,
  );

  if (!activeComment) {
    return null;
  }

  // Use real-time position if available, otherwise fall back to layout
  const startX = nodeX ?? activeComment.x;
  const lineY = (nodeY ?? activeComment.y) + VERTICAL_OFFSET;
  const endX = startX + LINE_LENGTH;

  const strokeWidth = 3 / zoom;
  const capHeight = END_CAP_HEIGHT / zoom;

  return (
    <svg
      className="group-connector-lines"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: -1,
      }}
    >
      <g
        transform={`translate(${transform[0]},${transform[1]}) scale(${transform[2]})`}
      >
        {/* The horizontal line */}
        <line
          x1={startX}
          y1={lineY}
          x2={endX}
          y2={lineY}
          stroke={LINE_COLOR}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Vertical end cap at start */}
        <line
          x1={startX}
          y1={lineY - capHeight / 2}
          x2={startX}
          y2={lineY + capHeight / 2}
          stroke={LINE_COLOR}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Vertical end cap at end */}
        <line
          x1={endX}
          y1={lineY - capHeight / 2}
          x2={endX}
          y2={lineY + capHeight / 2}
          stroke={LINE_COLOR}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
};

export default GroupConnectorLines;
