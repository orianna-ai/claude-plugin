import { FC, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "reactflow";

import type { ElementOutput as Element } from "../../api/types.gen";
import { useLayout } from "../../hooks/useLayout";

import { useCanvasContext } from "./CanvasContext";

// Padding around the bounding box in canvas units (grid size is 40px)
// Left/right/top: 2 grid elements = 80px
// Bottom: 1.5 grid elements = 60px (half grid less to account for text line height)
const BOX_PADDING = 80;
const BOX_PADDING_BOTTOM = 60;
// Bounding box colors
const BOX_STROKE_COLOR = "#988D82";
const BOX_FILL_COLOR = "rgba(69, 51, 33, 0.03)";
// Corner radius for the bounding box
const CORNER_RADIUS = 20;

interface BoundingBox {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

/**
 * Get the actual rendered height of a text element by querying the DOM.
 * Falls back to slot.height if the element is not found.
 */
function getActualTextHeight(slotId: string, fallbackHeight: number): number {
  // Try to find the text-node-display div which contains the text content
  // The hit-area span is inside it with the data-slot-id attribute
  const hitArea = document.querySelector<HTMLElement>(
    `.text-node-hit-area[data-slot-id="${slotId}"]`,
  );
  // Get the parent display div for accurate height measurement
  const displayDiv = hitArea?.closest<HTMLElement>(".text-node-display");
  if (displayDiv) {
    return displayDiv.offsetHeight;
  }
  return fallbackHeight;
}

/**
 * Calculate the bottom edge of an element, using actual DOM height for text elements.
 */
function getElementBottom(element: Element): number {
  const { slot } = element;
  if (slot.content_type === "text") {
    const actualHeight = getActualTextHeight(slot.id, slot.height);
    return slot.y + actualHeight;
  }
  return slot.y + slot.height;
}

/**
 * Renders a bounding box around grouped mocks when a comment with multiple
 * image slots is hovered or selected.
 */
const GroupBoundingBox: FC = () => {
  const { activeGroupNodeId } = useCanvasContext();
  const { layout } = useLayout();
  const transform = useStore((s) => s.transform);
  const zoom = transform[2];

  // Store the last valid bounding box for fade-out animation
  const lastBoundsRef = useRef<BoundingBox | null>(null);

  // Force re-render when activeGroupNodeId changes to re-measure DOM heights
  const [, setMeasureKey] = useState(0);
  useEffect(() => {
    if (activeGroupNodeId) {
      // Small delay to ensure DOM is rendered before measuring
      const timer = setTimeout(() => setMeasureKey((k) => k + 1), 50);
      return () => clearTimeout(timer);
    }
  }, [activeGroupNodeId]);

  // Find the active comment
  const activeComment = layout.comments.find(
    (c) => c.id === activeGroupNodeId && !c.is_deleted,
  );

  // Find the image elements and their descriptions for the attached slot IDs
  const { imageElements, allElements } = useMemo(() => {
    const attachedSlotIds = activeComment?.attached_slot_ids ?? [];
    if (attachedSlotIds.length < 2)
      return { imageElements: [], allElements: [] };

    // Get image elements
    const images = layout.elements.filter(
      (el) =>
        attachedSlotIds.includes(el.slot.id) &&
        el.slot.content_type === "image",
    );

    // Also include description elements (they have IDs like "{slot_id}-desc")
    const descriptionIds = attachedSlotIds.map((id) => `${id}-desc`);
    const descriptions = layout.elements.filter((el) =>
      descriptionIds.includes(el.slot.id),
    );

    // Row captions (e.g. rev2-row0-caption) from attached image ids (e.g. rev2-row0-img0)
    const rowCaptionIds = new Set(
      attachedSlotIds
        .filter((id) => /-img\d+$/.test(id))
        .map((id) => id.replace(/-img\d+$/, "-caption")),
    );
    const rowCaptions = layout.elements.filter((el) =>
      rowCaptionIds.has(el.slot.id),
    );

    return {
      imageElements: images,
      allElements: [...images, ...descriptions, ...rowCaptions],
    };
  }, [activeComment?.attached_slot_ids, layout.elements]);

  // Determine if box should be visible
  const isVisible = imageElements.length >= 2;

  // Calculate bounding box from all elements (images + descriptions)
  // Use actual DOM heights for text elements
  const currentBounds: BoundingBox | null = useMemo(() => {
    if (allElements.length === 0) return null;

    const minX = Math.min(...allElements.map((e) => e.slot.x)) - BOX_PADDING;
    const minY = Math.min(...allElements.map((e) => e.slot.y)) - BOX_PADDING;
    const maxX =
      Math.max(...allElements.map((e) => e.slot.x + e.slot.width)) +
      BOX_PADDING;
    const maxY =
      Math.max(...allElements.map((e) => getElementBottom(e))) +
      BOX_PADDING_BOTTOM;

    return {
      minX,
      minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }, [allElements]);

  // Update last bounds when we have valid bounds
  if (currentBounds) {
    lastBoundsRef.current = currentBounds;
  }

  // Use current bounds if visible, otherwise use last bounds for fade-out
  const bounds = isVisible ? currentBounds : lastBoundsRef.current;

  // Don't render if we've never had valid bounds
  if (!bounds) {
    return null;
  }

  const strokeWidth = 1.5 / zoom;

  return (
    <svg
      className={`group-bounding-box${isVisible ? " visible" : ""}`}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 1,
      }}
    >
      <g
        transform={`translate(${transform[0]},${transform[1]}) scale(${transform[2]})`}
      >
        <rect
          x={bounds.minX}
          y={bounds.minY}
          width={bounds.width}
          height={bounds.height}
          rx={CORNER_RADIUS}
          ry={CORNER_RADIUS}
          fill={BOX_FILL_COLOR}
          stroke={BOX_STROKE_COLOR}
          strokeWidth={strokeWidth}
        />
      </g>
    </svg>
  );
};

export default GroupBoundingBox;
