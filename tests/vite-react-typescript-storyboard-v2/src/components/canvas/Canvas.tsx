import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  applyNodeChanges,
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  useReactFlow,
  useStore,
} from "reactflow";
import type {
  Node,
  NodeDragHandler,
  OnNodesChange,
  OnSelectionChangeFunc,
  SelectionDragHandler,
} from "reactflow";
import { isEqual } from "@ver0/deep-equal";
import { v4 as uuidv4 } from "uuid";

import { currentIdentity } from "../../identity";
import { DRIVE_CLIENT } from "../../drive";
import type { Comment, ElementOutput as Element, TextContent } from "../../api/types.gen";
import {
  DESCRIPTION_HEIGHT,
  GRID_SIZE,
  IMAGE_HEIGHT,
  SLOT_GAP,
  SLOT_WIDTH,
} from "../../api/layout";
import { useAgent } from "../../hooks/useAgent";
import { useCanvasMode } from "../../hooks/useCanvasMode";
import { useHistory } from "../../hooks/useHistory";
import { useLayout } from "../../hooks/useLayout";
import { captureScreenshot } from "../../utils/captureScreenshot";

import CommentNode from "./nodes/CommentNode";
import ImageNode from "./nodes/ImageNode";
import MultiTextNodeToolbar from "./nodes/MultiTextNodeToolbar";
import TextNode from "./nodes/TextNode";
import { CanvasContextProvider, useCanvasContext } from "./CanvasContext";
import EmptyCanvasOverlay from "./EmptyCanvasOverlay";
import GroupBoundingBox from "./GroupBoundingBox";

import "reactflow/dist/style.css";
import "./Canvas.css";

const NODE_DRAG_THRESHOLD_PX = 5;
const SNAP_THRESHOLD = 5;

// Session storage key for cross-canvas copy/paste
const CLIPBOARD_KEY = "orianna-canvas-clipboard";

function getClipboard(): Element[] {
  try {
    const data = sessionStorage.getItem(CLIPBOARD_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function setClipboard(elements: Element[]): void {
  sessionStorage.setItem(CLIPBOARD_KEY, JSON.stringify(elements));
}

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
];

// Layout constants imported from API (single source of truth)
const DROPPED_IMAGE_WIDTH = SLOT_WIDTH;
const DROPPED_IMAGE_HEIGHT = IMAGE_HEIGHT;
const DROPPED_IMAGE_GAP = SLOT_GAP;
// user-created text elements start in auto-width mode (0 = auto-width)
const TEXT_ELEMENT_WIDTH = 0;
const TEXT_ELEMENT_HEIGHT = DESCRIPTION_HEIGHT;

function snapToGrid(value: number): number {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

// Check if a click is within a text node's hit area (actual text content)
// Uses getClientRects() to get per-line rects, which allows us to:
// - Accept clicks in line-height gaps between wrapped text lines
// - Reject clicks in empty lines (from explicit \n\n newlines)
// - Reject clicks in horizontal empty space
function isClickInTextHitArea(
  hitArea: globalThis.Element,
  e: MouseEvent,
): boolean {
  const rects = hitArea.getClientRects();

  for (let i = 0; i < rects.length; i++) {
    const rect = rects[i];

    // Check if click is within this line's rect
    if (
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom
    ) {
      return true;
    }

    // Check if click is in line-height gap between this line and the next
    // (only valid if lines are vertically adjacent - not separated by empty lines)
    const nextRect = rects[i + 1];
    if (nextRect && e.clientY > rect.bottom && e.clientY < nextRect.top) {
      // Use the horizontal bounds of both lines (union)
      const left = Math.min(rect.left, nextRect.left);
      const right = Math.max(rect.right, nextRect.right);
      if (e.clientX >= left && e.clientX <= right) {
        // Check if lines are "adjacent" (gap is just line-height spacing)
        // vs separated by empty lines (gap is much larger)
        // Adjacent lines have gap < 80% of line height
        const gap = nextRect.top - rect.bottom;
        const lineHeight = rect.height;
        if (gap < lineHeight * 0.8) {
          return true;
        }
      }
    }
  }

  return false;
}

// Calculate alignment helper lines for a dragged node against other nodes
function calculateAlignment(
  draggedPosition: { x: number; y: number },
  draggedWidth: number,
  draggedHeight: number,
  draggingIds: Set<string>,
  allNodes: Node[],
): {
  helperLineH: {
    position: number;
    edge: "top" | "bottom" | "center";
    xMin: number;
    xMax: number;
  } | null;
  helperLineV: {
    position: number;
    edge: "left" | "right" | "center";
    yMin: number;
    yMax: number;
  } | null;
} {
  // Snap position to grid first so alignment lines match the visual element position
  const snappedX = Math.round(draggedPosition.x / GRID_SIZE) * GRID_SIZE;
  const snappedY = Math.round(draggedPosition.y / GRID_SIZE) * GRID_SIZE;

  const dragLeft = snappedX;
  const dragRight = snappedX + draggedWidth;
  const dragCenterX = snappedX + draggedWidth / 2;
  const dragTop = snappedY;
  const dragBottom = snappedY + draggedHeight;
  const dragCenterY = snappedY + draggedHeight / 2;

  let closestH: {
    position: number;
    edge: "top" | "bottom" | "center";
    xMin: number;
    xMax: number;
  } | null = null;
  let closestV: {
    position: number;
    edge: "left" | "right" | "center";
    yMin: number;
    yMax: number;
  } | null = null;
  let minDistH = SNAP_THRESHOLD;
  let minDistV = SNAP_THRESHOLD;

  for (const node of allNodes) {
    // Skip all nodes that are part of the current drag operation
    if (draggingIds.has(node.id)) continue;

    // Skip comments - they shouldn't be alignment targets for other content
    if (node.type === "CommentNode") continue;

    const nodeW = node.width ?? 0;
    const nodeH = node.height ?? 0;
    const nodeLeft = node.position.x;
    const nodeRight = node.position.x + nodeW;
    const nodeCenterX = node.position.x + nodeW / 2;
    const nodeTop = node.position.y;
    const nodeBottom = node.position.y + nodeH;
    const nodeCenterY = node.position.y + nodeH / 2;

    // Check vertical alignments (X positions)
    // Line spans from top of topmost element to bottom of bottommost
    const vChecks: Array<{
      drag: number;
      node: number;
      edge: "left" | "right" | "center";
    }> = [
      { drag: dragLeft, node: nodeLeft, edge: "left" },
      { drag: dragLeft, node: nodeRight, edge: "left" },
      { drag: dragRight, node: nodeLeft, edge: "right" },
      { drag: dragRight, node: nodeRight, edge: "right" },
      { drag: dragCenterX, node: nodeCenterX, edge: "center" },
    ];
    for (const { drag, node: nodeVal, edge } of vChecks) {
      const dist = Math.abs(drag - nodeVal);
      if (dist < minDistV) {
        minDistV = dist;
        closestV = {
          position: nodeVal,
          edge,
          yMin: Math.min(dragTop, nodeTop),
          yMax: Math.max(dragBottom, nodeBottom),
        };
      }
    }

    // Check horizontal alignments (Y positions)
    // Line spans from left of leftmost element to right of rightmost
    const hChecks: Array<{
      drag: number;
      node: number;
      edge: "top" | "bottom" | "center";
    }> = [
      { drag: dragTop, node: nodeTop, edge: "top" },
      { drag: dragTop, node: nodeBottom, edge: "top" },
      { drag: dragBottom, node: nodeTop, edge: "bottom" },
      { drag: dragBottom, node: nodeBottom, edge: "bottom" },
      { drag: dragCenterY, node: nodeCenterY, edge: "center" },
    ];
    for (const { drag, node: nodeVal, edge } of hChecks) {
      const dist = Math.abs(drag - nodeVal);
      if (dist < minDistH) {
        minDistH = dist;
        closestH = {
          position: nodeVal,
          edge,
          xMin: Math.min(dragLeft, nodeLeft),
          xMax: Math.max(dragRight, nodeRight),
        };
      }
    }
  }

  return { helperLineH: closestH, helperLineV: closestV };
}

function Canvas() {
  const reactFlowInstance = useReactFlow();
  // Ref to access reactFlowInstance in event handlers without stale closures
  const reactFlowInstanceRef = useRef(reactFlowInstance);
  reactFlowInstanceRef.current = reactFlowInstance;
  const transform = useStore((s) => s.transform);
  const zoom = transform[2];

  const { mode, setMode, setIsSelectionBoxDragging } = useCanvasMode();
  const { commitBeforeChange } = useHistory();
  const {
    layout,
    createComment,
    updateComments,
    updateElements,
    deleteElements,
  } = useLayout();
  const { isResponding } = useAgent();
  const {
    selectedCommentId,
    setSelectedCommentId,
    currentlyEditingNodeId,
    setIsPanDragging,
  } = useCanvasContext();

  // Keep a ref to currentlyEditingNodeId so mousedown handler always has latest value
  const currentlyEditingNodeIdRef = useRef(currentlyEditingNodeId);
  useEffect(() => {
    currentlyEditingNodeIdRef.current = currentlyEditingNodeId;
  }, [currentlyEditingNodeId]);

  // Keep a ref to mode so handleNodesChange can filter selection without re-creating
  const modeRef = useRef(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // get nodes visible in the current viewport (for snapping/alignment)
  const getVisibleNodes = useCallback(() => {
    const container = document.querySelector(".canvas-wrapper");
    if (!container) return nodesRef.current;

    const rect = container.getBoundingClientRect();
    const topLeft = reactFlowInstance?.screenToFlowPosition({ x: 0, y: 0 });
    const bottomRight = reactFlowInstance?.screenToFlowPosition({
      x: rect.width,
      y: rect.height,
    });
    if (!topLeft || !bottomRight) return nodesRef.current;

    const visibleNodes = nodesRef.current.filter((node) => {
      const nodeW = node.width ?? 0;
      const nodeH = node.height ?? 0;
      const nodeRight = node.position.x + nodeW;
      const nodeBottom = node.position.y + nodeH;

      // check if node's bounding box intersects with viewport
      return !(
        nodeRight < topLeft.x ||
        node.position.x > bottomRight.x ||
        nodeBottom < topLeft.y ||
        node.position.y > bottomRight.y
      );
    });

    return visibleNodes;
  }, [reactFlowInstance]);

  // Show when: no elements AND no comments AND no request in flight
  const hasAnyComments = layout.comments.some((c) => !c.is_deleted);
  const showEmptyOverlay =
    layout.elements.length === 0 && !hasAnyComments && !isResponding;

  // Clear selection if the selected comment was deleted (e.g., by another user)
  useEffect(() => {
    if (!selectedCommentId) return;
    const comment = layout.comments.find((c) => c.id === selectedCommentId);
    if (!comment || comment.is_deleted) {
      setSelectedCommentId(null);
    }
  }, [layout.comments, selectedCommentId, setSelectedCommentId]);

  // Drag and drop state
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const dragCounterRef = useRef(0);

  // Track last image paste position (separate from canvas element clipboard)
  // This gets cleared when user copies from canvas (new copy operation)
  const lastImagePasteRef = useRef<{ x: number; y: number } | null>(null);

  const [nodes, setNodes] = useState<Node[]>([]);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  // Track if nodes are being dragged (for hiding toolbars during drag)
  const [isDraggingNodes, setIsDraggingNodes] = useState(false);
  // Ref to access current selection without stale closures
  // IMPORTANT: This is updated in handleSelectionChange, not on render,
  // to ensure it's always current even before React re-renders
  const selectedNodeIdsRef = useRef<string[]>([]);
  // Ref to capture selection at mousedown time (before blur/focus/selection events)
  // This ensures we know what was selected BEFORE the click, not after ReactFlow processes it
  const selectionAtMouseDownRef = useRef<string[]>([]);

  // Helper lines for alignment guides (Figma-style)
  // Edge type tracks which edge of the dragged element is aligned, so we can
  // shift the line to align with the selection outline (which extends outside)
  // xMin/xMax and yMin/yMax define the line bounds (spanning only the aligned content)
  const [helperLineH, setHelperLineH] = useState<{
    position: number;
    edge: "top" | "bottom" | "center";
    xMin: number;
    xMax: number;
  } | null>(null);
  const [helperLineV, setHelperLineV] = useState<{
    position: number;
    edge: "left" | "right" | "center";
    yMin: number;
    yMax: number;
  } | null>(null);

  // Custom selection box state (in flow coordinates for pan-while-selecting)
  const [selectionBox, setSelectionBox] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  const isSelectingRef = useRef(false);
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);

  // Track if nodes are being dragged (for pan-while-dragging support)
  const isDraggingNodesRef = useRef(false);
  // Track if we're currently updating positions due to panning (to suppress helper lines)
  const isPanningDuringDragRef = useRef(false);
  // Store the "ideal" (unsnapped) node positions during drag - accumulates sub-grid movement
  const idealPositionsRef = useRef<Map<string, { x: number; y: number }>>(
    new Map(),
  );
  // Track if we've set up "pending drag" state on mousedown (before ReactFlow fires onNodeDragStart)
  const isPendingDragRef = useRef(false);
  // Track when mouseup occurred (to debounce spurious mousedown from trackpad touches)
  const lastMouseupTimestampRef = useRef<number>(0);

  // Track spacebar hold for pan cursor
  const [isSpacebarHeld, setIsSpacebarHeld] = useState(false);

  /* Multi-select share button state (disabled - button removed from UI)
  const [showMultiShareButton, setShowMultiShareButton] = useState(false);
  const [isMultiShareButtonVisible, setIsMultiShareButtonVisible] =
    useState(false); */

  // Track if we have a pending paste from "share in new page" flow
  // Check on every render since navigation might update the URL after mount
  const isPastePendingRef = useRef(false);
  const hasPastedRef = useRef(false);

  // Check URL on every render (before effects run)
  if (!hasPastedRef.current) {
    const urlParams = new URLSearchParams(window.location.search);
    isPastePendingRef.current = urlParams.get("paste") === "true";
  }

  // ---- Text auto-sizing (centralized + batched) -----------------------------
  //
  // TextNode display elements render with `data-slot-id`. We observe all text
  // display nodes and batch height updates into a single `updateElements` call
  // per animation frame to avoid N-per-node layout writes.
  const layoutElementsRef = useRef(layout.elements);
  useEffect(() => {
    layoutElementsRef.current = layout.elements;
  }, [layout.elements]);

  // Ref for comments to access in native event handlers without stale closures
  const layoutCommentsRef = useRef(layout.comments);
  useEffect(() => {
    layoutCommentsRef.current = layout.comments;
  }, [layout.comments]);

  // Ref for selectedCommentId to access in native event handlers without stale closures
  const selectedCommentIdRef = useRef(selectedCommentId);
  useEffect(() => {
    selectedCommentIdRef.current = selectedCommentId;
  }, [selectedCommentId]);

  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const observedTextElsRef = useRef<Set<HTMLElement>>(new Set());
  const pendingTextHeightsRef = useRef<Map<string, number>>(new Map());
  const flushRafRef = useRef<number | null>(null);
  const flushChainRef = useRef(Promise.resolve());

  const flushPendingTextHeights = useCallback(() => {
    flushRafRef.current = null;

    const pending = pendingTextHeightsRef.current;
    if (pending.size === 0) return;

    const byId = new Map<string, Element>(
      layoutElementsRef.current.map((e) => [e.slot.id, e]),
    );

    const updates: Element[] = [];
    for (const [slotId, height] of pending.entries()) {
      const el = byId.get(slotId);
      if (!el) continue;
      if (el.slot.height === height) continue;
      // Only auto-size text elements.
      if (el.content?.type !== "text") continue;
      updates.push({
        ...el,
        slot: {
          ...el.slot,
          height,
        },
      });
    }

    pending.clear();

    if (updates.length === 0) return;

    // Serialize updates so concurrent observer bursts don't interleave writes.
    flushChainRef.current = flushChainRef.current
      .then(() => updateElements(updates, { preserveExistingPositions: true }))
      .catch(console.error);
  }, [updateElements]);

  useEffect(() => {
    const wrapper = canvasWrapperRef.current;
    if (!wrapper) return;

    // Capture ref-backed collections for stable cleanup references.
    const observedTextEls = observedTextElsRef.current;
    const pendingTextHeights = pendingTextHeightsRef.current;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const target = entry.target as HTMLElement;
        const slotId = target.dataset.slotId;
        if (!slotId) continue;

        const scrollHeight = target.scrollHeight;
        const snappedHeight = Math.ceil(scrollHeight / GRID_SIZE) * GRID_SIZE;

        pendingTextHeightsRef.current.set(slotId, snappedHeight);
      }

      if (flushRafRef.current == null) {
        flushRafRef.current = window.requestAnimationFrame(
          flushPendingTextHeights,
        );
      }
    });

    resizeObserverRef.current = observer;

    return () => {
      if (flushRafRef.current != null) {
        window.cancelAnimationFrame(flushRafRef.current);
        flushRafRef.current = null;
      }
      observer.disconnect();
      resizeObserverRef.current = null;
      observedTextEls.clear();
      pendingTextHeights.clear();
    };
  }, [flushPendingTextHeights]);

  // Keep the observer attached to all currently-mounted text display elements.
  useEffect(() => {
    const wrapper = canvasWrapperRef.current;
    const observer = resizeObserverRef.current;
    if (!wrapper || !observer) return;

    const selector = "div.text-node-hit-area[data-slot-id]";
    const next = new Set(
      Array.from(wrapper.querySelectorAll<HTMLElement>(selector)),
    );

    // Observe newly added elements
    for (const el of next) {
      if (!observedTextElsRef.current.has(el)) {
        observedTextElsRef.current.add(el);
        observer.observe(el);
      }
    }

    // Unobserve removed elements
    for (const el of Array.from(observedTextElsRef.current)) {
      if (!next.has(el)) {
        observedTextElsRef.current.delete(el);
        observer.unobserve(el);
      }
    }
  }, [nodes]);

  // Ref to access current nodes from callbacks without stale closures
  const nodesRef = useRef<Node[]>([]);
  nodesRef.current = nodes;

  // Track which node IDs are currently being dragged to prevent layout sync from resetting positions
  const draggingNodeIdsRef = useRef<Set<string>>(new Set());

  // Use savedPositionsRef from context - this is shared with TextNode for resize protection
  const { savedPositionsRef } = useCanvasContext();

  // Track element IDs that existed before "Design next rev" was clicked
  const previousElementIdsRef = useRef<Set<string> | null>(null);
  // Track if we're waiting for new elements to appear
  const waitingForNewElementsRef = useRef(false);
  // Track if we've done the initial fit (first time elements appear)
  const hasInitialFitRef = useRef(false);
  // Track if ReactFlow has been initialized (as state so effects re-run when it changes)
  const [isReactFlowReady, setIsReactFlowReady] = useState(false);
  // Track if the initial viewport has been set (prevents flicker on page load)
  const [isInitialViewportSet, setIsInitialViewportSet] = useState(false);
  // Track pending fit request - stores node IDs to fit to once they exist in ReactFlow
  const pendingFitRef = useRef<{ ids: string[]; duration: number } | null>(
    null,
  );
  // Track node IDs that should be selected when they first appear
  const pendingSelectionRef = useRef<Set<string>>(new Set());

  // Helper function to fit view to specific node IDs
  const doFitView = useCallback(
    (nodeIds: string[], duration: number = 400) => {
      // Use fitView with a filter for specific nodes
      // Use 0.2 padding (20%) to account for floating UI elements (header at top, floating bar at bottom)
      reactFlowInstance.fitView({
        nodes: nodeIds.map((id) => ({ id })),
        duration,
        padding: 0.2,
      });
    },
    [reactFlowInstance],
  );

  // Helper function to fit bounds to a set of elements
  // Executes immediately if conditions are met, otherwise schedules for later
  const fitBoundsToElements = useCallback(
    (elements: readonly Element[], duration: number = 400) => {
      if (elements.length === 0) {
        return;
      }

      const nodeIds = elements.map((e) => e.slot.id);

      // Check if we can execute immediately (all nodes already exist)
      const nodeIdSet = new Set(nodesRef.current.map((n) => n.id));
      const allExist = nodeIds.every((id) => nodeIdSet.has(id));

      if (isReactFlowReady && allExist) {
        doFitView(nodeIds, duration);
        // Mark viewport as ready after fit (use RAF to ensure render completes)
        // Only set if not already set (initial fit only)
        if (!isInitialViewportSet) {
          requestAnimationFrame(() => setIsInitialViewportSet(true));
        }
      } else {
        // Store the fit request - the effect will execute it once nodes exist in state
        pendingFitRef.current = { ids: nodeIds, duration };
      }
    },
    [isReactFlowReady, doFitView, isInitialViewportSet],
  );

  // Callback when ReactFlow is initialized
  const handleInit = useCallback(() => {
    setIsReactFlowReady(true);
    // The pending fit effect will handle any pending fits once this state update triggers a re-render
  }, []);

  // Listen for the focus-new-design event
  useEffect(() => {
    const handleFocusNewDesign = () => {
      // Store current element IDs so we can identify new ones
      previousElementIdsRef.current = new Set(
        layout.elements.map((e) => e.slot.id),
      );
      waitingForNewElementsRef.current = true;
    };

    window.addEventListener("focus-new-design", handleFocusNewDesign);

    return () => {
      window.removeEventListener("focus-new-design", handleFocusNewDesign);
    };
  }, [layout.elements]);

  // Listen for pan-to-latest event to pan to the MOST RECENT revision only
  useEffect(() => {
    const handlePanToLatest = () => {
      // Filter out user-created elements (only show AI-generated)
      const generatedElements = layout.elements.filter(
        (e) => e.slot.source !== "user",
      );

      if (generatedElements.length === 0) return;

      // Find the highest revision number
      // Slot IDs: "title", "desc", "img-0" (initial) vs "rev0-title", "rev1-title" (revisions)
      let maxRevNum = -1; // -1 means initial (no rev prefix)
      for (const el of generatedElements) {
        const match = el.slot.id.match(/^rev(\d+)-/);
        if (match) {
          maxRevNum = Math.max(maxRevNum, parseInt(match[1], 10));
        }
      }

      // Filter to only include elements from the most recent revision
      let latestRevElements: Element[];
      if (maxRevNum === -1) {
        // No revisions yet, show initial elements (no "rev" prefix)
        latestRevElements = generatedElements.filter(
          (e) => !e.slot.id.startsWith("rev"),
        );
      } else {
        // Show only elements from the latest revision
        const prefix = `rev${maxRevNum}-`;
        latestRevElements = generatedElements.filter((e) =>
          e.slot.id.startsWith(prefix),
        );
      }

      if (latestRevElements.length > 0) {
        fitBoundsToElements(latestRevElements);
      }
    };

    window.addEventListener("pan-to-latest", handlePanToLatest);

    return () => {
      window.removeEventListener("pan-to-latest", handlePanToLatest);
    };
  }, [layout.elements, fitBoundsToElements]);

  // Listen for focus-comment event to pan/zoom canvas when a comment with attached images is selected
  // This ensures the attached images are visible with room for the popover on the left
  useEffect(() => {
    const handleFocusComment = (
      e: CustomEvent<{
        commentId: string;
        attachedSlotIds: string[];
        commentX: number;
        commentY: number;
      }>,
    ) => {
      const { attachedSlotIds, commentX, commentY } = e.detail;

      // Find the attached image elements
      const attachedElements = layout.elements.filter(
        (el) =>
          attachedSlotIds.includes(el.slot.id) &&
          el.slot.content_type === "image",
      );

      if (attachedElements.length === 0) return;

      // Get current viewport
      const currentViewport = reactFlowInstance.getViewport();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Reserve space for popover on the left (popover is ~364px wide + gap)
      const popoverSpace = 400;
      // Reserve space for UI elements (header top, floating bar bottom)
      const topPadding = 80;
      const bottomPadding = 120;

      // Convert comment position to screen coordinates with current viewport
      const commentScreenX =
        commentX * currentViewport.zoom + currentViewport.x;
      const commentScreenY =
        commentY * currentViewport.zoom + currentViewport.y;

      // Check if comment is already positioned with enough room for popover
      const hasRoomForPopover = commentScreenX > popoverSpace;
      const isContentVisible =
        commentScreenX > 0 &&
        commentScreenX < viewportWidth - 100 &&
        commentScreenY > topPadding &&
        commentScreenY < viewportHeight - bottomPadding;

      if (hasRoomForPopover && isContentVisible) {
        // Already well-positioned, don't pan
        return;
      }

      // Strategy: primarily pan, only zoom out slightly if needed
      // Keep current zoom unless we really need to zoom out
      let targetZoom = currentViewport.zoom;

      // Calculate max X of attached images
      const maxX = Math.max(
        ...attachedElements.map((el) => el.slot.x + el.slot.width),
      );

      // Check if content would fit at current zoom with popover space
      // Only calculate if images are to the right of the comment (maxX > commentX)
      const contentWidth = maxX - commentX;
      const availableWidth = viewportWidth - popoverSpace - 60;

      // Only zoom out if content is too wide and we have valid dimensions
      if (contentWidth > 0) {
        const contentWidthAtCurrentZoom = contentWidth * currentViewport.zoom;
        if (contentWidthAtCurrentZoom > availableWidth) {
          const neededZoom = availableWidth / contentWidth;
          // Don't zoom out more than 20% from current zoom
          targetZoom = Math.max(neededZoom, currentViewport.zoom * 0.8);
          // Absolute minimum zoom
          targetZoom = Math.max(targetZoom, 0.4);
        }
      }

      // Calculate target position to place comment with room for popover on the left
      // Position comment at popoverSpace from left edge, with some top padding
      const targetX = popoverSpace - commentX * targetZoom;
      const targetY = topPadding + 50 - commentY * targetZoom;

      // Animate to the new viewport
      reactFlowInstance.setViewport(
        { x: targetX, y: targetY, zoom: targetZoom },
        { duration: 300 },
      );
    };

    window.addEventListener(
      "focus-comment",
      handleFocusComment as EventListener,
    );

    return () => {
      window.removeEventListener(
        "focus-comment",
        handleFocusComment as EventListener,
      );
    };
  }, [layout.elements, reactFlowInstance]);

  // Reset initial fit tracking when layout becomes empty (new design)
  // Also show canvas immediately for empty canvas since there's nothing to fit to
  useEffect(() => {
    if (layout.elements.length === 0) {
      hasInitialFitRef.current = false;
      // Empty canvas - show immediately with default viewport
      if (isReactFlowReady && !isInitialViewportSet) {
        setIsInitialViewportSet(true);
      }
    }
  }, [layout.elements.length, isReactFlowReady, isInitialViewportSet]);

  // Clear position protection before undo/redo so positions can be restored
  // Uses capture phase to run BEFORE useHistory's listener
  useEffect(() => {
    const handleUndoRedo = (e: KeyboardEvent) => {
      // Skip if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      // Detect undo (Cmd/Ctrl+Z) or redo (Cmd/Ctrl+Shift+Z or Cmd/Ctrl+Y)
      if (modifier && (e.key === "z" || e.key === "y")) {
        // Clear all position protection so undo/redo can restore positions
        savedPositionsRef.current.clear();
      }
    };

    // Capture phase runs before bubble phase (where useHistory listens)
    window.addEventListener("keydown", handleUndoRedo, { capture: true });

    return () => {
      window.removeEventListener("keydown", handleUndoRedo, { capture: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- savedPositionsRef is stable (ref from context)
  }, []);

  // Track spacebar hold for pan cursor (ReactFlow enables panning with spacebar)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        // Don't trigger if typing in an input
        if (
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          (e.target instanceof HTMLElement && e.target.isContentEditable)
        ) {
          return;
        }
        setIsSpacebarHeld(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsSpacebarHeld(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Fix for "stuck Command key" after macOS screenshot (Command+Shift+4):
  // When taking a screenshot, the browser may not receive the keyup event for Command
  // because the screenshot tool captures input. ReactFlow then thinks Command is still
  // held, causing trackpad scroll to zoom instead of pan.
  // We track Meta keydown and only dispatch a synthetic keyup on the first wheel event
  // after Meta was pressed but not released (to avoid firing hundreds of times per scroll).
  useEffect(() => {
    let metaMayBeStuck = false;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Meta") {
        metaMayBeStuck = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Meta") {
        metaMayBeStuck = false;
      }
    };

    const handleWheel = (e: WheelEvent) => {
      // Only dispatch synthetic keyup if Meta was pressed and we haven't seen a keyup,
      // AND the wheel event says Meta isn't actually pressed
      if (metaMayBeStuck && !e.metaKey) {
        metaMayBeStuck = false;
        document.dispatchEvent(
          new KeyboardEvent("keyup", {
            key: "Meta",
            code: "MetaLeft",
            keyCode: 91,
            which: 91,
            metaKey: false,
            bubbles: true,
            cancelable: true,
          }),
        );
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    window.addEventListener("keyup", handleKeyUp, { capture: true });
    window.addEventListener("wheel", handleWheel, { capture: true });

    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
      window.removeEventListener("keyup", handleKeyUp, { capture: true });
      window.removeEventListener("wheel", handleWheel, { capture: true });
    };
  }, []);

  // Parse element ID from URL hash (e.g., #element=img-0)
  const getElementIdFromHash = useCallback(() => {
    const hash = window.location.hash;
    if (!hash) return null;
    const match = hash.match(/^#element=(.+)$/);
    return match ? decodeURIComponent(match[1]) : null;
  }, []);

  // Initial fit: when elements first appear on canvas load
  // If URL hash has element anchor, zoom to that element instead
  useEffect(() => {
    if (hasInitialFitRef.current) {
      return;
    }
    if (layout.elements.length === 0) {
      return;
    }

    // Elements just appeared for the first time - fit to all of them
    hasInitialFitRef.current = true;

    // Check if URL has an element anchor
    const anchorElementId = getElementIdFromHash();
    if (anchorElementId) {
      const anchorElement = layout.elements.find(
        (e) => e.slot.id === anchorElementId,
      );
      if (anchorElement) {
        // Zoom to the specific element from the URL anchor
        fitBoundsToElements([anchorElement], 0);
        return;
      }
    }

    // No anchor or element not found - fit to all elements
    const elementsToFit = [...layout.elements];

    // Schedule the fit - the pending-fit effect will execute it once nodes exist
    fitBoundsToElements(elementsToFit, 0);
  }, [
    layout.elements,
    fitBoundsToElements,
    isReactFlowReady,
    getElementIdFromHash,
  ]);

  // Pan and zoom to new elements when they appear after "Design next rev"
  useEffect(() => {
    if (!waitingForNewElementsRef.current || !previousElementIdsRef.current) {
      return;
    }

    // Find new elements (elements that weren't in the previous set)
    const newElements = layout.elements.filter(
      (e) => !previousElementIdsRef.current!.has(e.slot.id),
    );

    if (newElements.length === 0) {
      return;
    }

    fitBoundsToElements(newElements);

    // Reset the waiting state
    waitingForNewElementsRef.current = false;
    previousElementIdsRef.current = null;
  }, [layout.elements, fitBoundsToElements]);

  // update nodes when the layout changes
  useEffect(() => {
    setNodes((currentNodes) => {
      const currentNodesById = new Map(currentNodes.map((n) => [n.id, n]));

      // Capture dragging node IDs at effect time to avoid race conditions
      const draggingIds = draggingNodeIdsRef.current;

      const newNodes = [
        ...layout.elements.map((element) => {
          const node = getNodeFromElement(element);
          const existingNode = currentNodesById.get(node.id);

          if (!existingNode) {
            // Check if this new node should be selected
            if (pendingSelectionRef.current.has(node.id)) {
              pendingSelectionRef.current.delete(node.id);
              return { ...node, selected: true };
            }
            return node;
          }

          // FIRST: Check savedPositionsRef - if within protection window, use saved position unconditionally
          // This prevents stale SSE updates from snapping nodes back after a drag
          const saved = savedPositionsRef.current.get(node.id);
          const now = Date.now();
          if (saved && now < saved.protectedUntil) {
            const dataUnchanged = isEqual(existingNode.data, node.data);
            if (
              dataUnchanged &&
              existingNode.position.x === saved.x &&
              existingNode.position.y === saved.y &&
              existingNode.selectable === node.selectable
            ) {
              return existingNode;
            }
            return {
              ...existingNode,
              data: node.data,
              position: { x: saved.x, y: saved.y },
              selectable: node.selectable,
            };
          }

          // SECOND: Check idealPositionsRef - if we have an ideal position, this node is being dragged
          const idealPos = idealPositionsRef.current.get(node.id);
          if (idealPos) {
            // Use ideal position (this is the TRUE position during pan-while-drag)
            const snappedX =
              node.type === "CommentNode"
                ? idealPos.x
                : Math.round(idealPos.x / GRID_SIZE) * GRID_SIZE;
            const snappedY =
              node.type === "CommentNode"
                ? idealPos.y
                : Math.round(idealPos.y / GRID_SIZE) * GRID_SIZE;

            const dataUnchanged = isEqual(existingNode.data, node.data);
            if (
              dataUnchanged &&
              existingNode.position.x === snappedX &&
              existingNode.position.y === snappedY &&
              existingNode.selectable === node.selectable
            ) {
              return existingNode;
            }
            return {
              ...existingNode,
              data: node.data,
              position: { x: snappedX, y: snappedY },
              selectable: node.selectable,
            };
          }

          // THIRD: If currently dragging this node but no ideal/saved position, preserve existing
          if (draggingIds.has(node.id)) {
            const dataUnchanged = isEqual(existingNode.data, node.data);
            if (dataUnchanged && existingNode.selectable === node.selectable) {
              return existingNode;
            }
            return {
              ...existingNode,
              data: node.data,
              selectable: node.selectable,
            };
          }

          // Normal case: update both data and position from layout
          // This is important for undo/redo, multi-user sync, and initial load
          const dataUnchanged = isEqual(existingNode.data, node.data);
          const positionUnchanged =
            existingNode.position.x === node.position.x &&
            existingNode.position.y === node.position.y;
          // Ensure selectable is always correct for text nodes
          const selectableCorrect = existingNode.selectable === node.selectable;

          if (dataUnchanged && positionUnchanged && selectableCorrect) {
            return existingNode;
          }

          return {
            ...existingNode,
            data: node.data,
            position: node.position,
            selectable: node.selectable,
          };
        }),
        // Only render root comments (those without thread_id) as canvas nodes.
        // Reply comments (with thread_id) are shown inside the thread view when
        // you open the root comment, not as separate bubbles on the canvas.
        ...layout.comments
          .filter((comment) => !comment.thread_id)
          .map((comment) => {
            const commentDraggable = mode !== "pan";
            const isCommentSelected = selectedCommentId === comment.id;
            const node = getNodeFromComment(
              comment,
              commentDraggable,
              isCommentSelected,
            );
            const existingNode = currentNodesById.get(node.id);

            if (!existingNode) {
              return node;
            }

            // Check savedPositionsRef - if within protection window, use saved position
            // This prevents stale SSE updates from snapping comments back after a drag
            const saved = savedPositionsRef.current.get(node.id);
            const now = Date.now();
            if (saved && now < saved.protectedUntil) {
              const dataUnchanged = isEqual(existingNode.data, node.data);
              const zIndexUnchanged = existingNode.zIndex === node.zIndex;
              if (
                dataUnchanged &&
                zIndexUnchanged &&
                existingNode.position.x === saved.x &&
                existingNode.position.y === saved.y
              ) {
                return existingNode;
              }
              return {
                ...existingNode,
                data: node.data,
                position: { x: saved.x, y: saved.y },
                zIndex: node.zIndex,
                draggable: commentDraggable,
              };
            }

            // If this comment is being dragged, preserve its current position
            if (draggingIds.has(node.id)) {
              const dataUnchanged = isEqual(existingNode.data, node.data);
              const zIndexUnchanged = existingNode.zIndex === node.zIndex;
              if (dataUnchanged && zIndexUnchanged) {
                return { ...existingNode, draggable: commentDraggable };
              }
              return {
                ...existingNode,
                data: node.data,
                zIndex: node.zIndex,
                draggable: commentDraggable,
              };
            }

            // Check if data, position, draggable, and zIndex are all unchanged
            const dataUnchanged = isEqual(existingNode.data, node.data);
            const positionUnchanged =
              existingNode.position.x === node.position.x &&
              existingNode.position.y === node.position.y;
            const draggableUnchanged =
              existingNode.draggable === commentDraggable;
            const zIndexUnchanged = existingNode.zIndex === node.zIndex;

            if (
              dataUnchanged &&
              positionUnchanged &&
              draggableUnchanged &&
              zIndexUnchanged
            ) {
              return existingNode;
            }

            // Update data, position, and draggable from layout
            return {
              ...existingNode,
              data: node.data,
              position: node.position,
              zIndex: node.zIndex,
              draggable: commentDraggable,
            };
          }),
      ];

      return newNodes;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- savedPositionsRef is stable (ref from context)
  }, [layout, mode, selectedCommentId]);

  // Effect that executes pending fits when both:
  // 1. ReactFlow is ready
  // 2. All requested nodes exist in the nodes state
  useEffect(() => {
    if (!pendingFitRef.current || !isReactFlowReady) {
      return;
    }

    const { ids, duration } = pendingFitRef.current;
    const nodeIdSet = new Set(nodes.map((n) => n.id));

    // Check if all pending nodes exist in ReactFlow
    const allExist = ids.every((id) => nodeIdSet.has(id));

    if (allExist) {
      // Clear the pending fit before executing to avoid re-triggering
      pendingFitRef.current = null;
      doFitView(ids, duration);
      // Mark viewport as ready after fit (use RAF to ensure render completes)
      // Only set if not already set (initial fit only)
      if (!isInitialViewportSet) {
        requestAnimationFrame(() => setIsInitialViewportSet(true));
      }
    }
  }, [nodes, isReactFlowReady, doFitView, isInitialViewportSet]);

  useEffect(() => {
    const handleFocusComment = (event: CustomEvent<{ id: string }>) => {
      const comment = layout.comments.find((c) => c.id === event.detail.id);
      if (comment) {
        const currentZoom = reactFlowInstance.getZoom();

        reactFlowInstance.setCenter(comment.x, comment.y, {
          duration: 300,
          zoom: currentZoom,
        });

        // Open the comment (selection is now local state)
        setSelectedCommentId(comment.id);
      }
    };

    window.addEventListener(
      "focus-comment",
      handleFocusComment as EventListener,
    );

    return () => {
      window.removeEventListener(
        "focus-comment",
        handleFocusComment as EventListener,
      );
    };
  }, [layout.comments, reactFlowInstance, setSelectedCommentId]);

  // Listen for canvas control events (zoom in, zoom out, fit view)
  useEffect(() => {
    const handleZoomIn = () => {
      reactFlowInstance.zoomIn({ duration: 200 });
    };

    const handleZoomOut = () => {
      reactFlowInstance.zoomOut({ duration: 200 });
    };

    const handleFitView = () => {
      reactFlowInstance.fitView({ duration: 300, padding: 0.2 });
    };

    window.addEventListener("canvas-zoom-in", handleZoomIn);
    window.addEventListener("canvas-zoom-out", handleZoomOut);
    window.addEventListener("canvas-fit-view", handleFitView);

    return () => {
      window.removeEventListener("canvas-zoom-in", handleZoomIn);
      window.removeEventListener("canvas-zoom-out", handleZoomOut);
      window.removeEventListener("canvas-fit-view", handleFitView);
    };
  }, [reactFlowInstance]);

  // Listen for select-node events (from EmptyCanvasOverlay)
  useEffect(() => {
    const handleSelectNode = (event: CustomEvent<{ id: string }>) => {
      const nodeId = event.detail.id;
      setNodes((currentNodes) =>
        currentNodes.map((node) => ({
          ...node,
          selected: node.id === nodeId,
        })),
      );
      setSelectedNodeIds([nodeId]);
    };

    window.addEventListener("select-node", handleSelectNode as EventListener);

    return () => {
      window.removeEventListener(
        "select-node",
        handleSelectNode as EventListener,
      );
    };
  }, []);

  // Listen for create-comment-at-center events (from EmptyCanvasOverlay)
  useEffect(() => {
    const handleCreateCommentAtCenter = async () => {
      const viewport = reactFlowInstance.getViewport();
      const wrapperBounds = canvasWrapperRef.current?.getBoundingClientRect();
      if (!wrapperBounds) return;

      const centerScreenX = wrapperBounds.width / 2;
      const centerScreenY = wrapperBounds.height / 2;

      const x = (centerScreenX - viewport.x) / viewport.zoom;
      const y = (centerScreenY - viewport.y) / viewport.zoom;

      const commentId = uuidv4().toString();
      const comment: Comment = {
        created_at: new Date().toISOString(),
        created_by: currentIdentity,
        id: commentId,
        images: [],
        is_deleted: false,
        is_editable: true,
        is_read: true,
        is_submitted: false,
        message: { type: "text", text: "" },
        x,
        y,
      };

      createComment(comment);
      setSelectedCommentId(commentId);

      setTimeout(async () => {
        const screenshot = await captureScreenshot({
          reactFlowInstance,
          x: comment.x,
          y: comment.y,
        });

        await updateComments({
          id: comment.id,
          screenshot,
        });
      }, 250);
    };

    window.addEventListener(
      "create-comment-at-center",
      handleCreateCommentAtCenter,
    );

    return () => {
      window.removeEventListener(
        "create-comment-at-center",
        handleCreateCommentAtCenter,
      );
    };
  }, [reactFlowInstance, createComment, updateComments, setSelectedCommentId]);

  // Clear selection when leaving select mode
  useEffect(() => {
    if (mode !== "select") {
      setNodes((currentNodes) =>
        currentNodes.map((node) => ({ ...node, selected: false })),
      );
    }
  }, [mode]);

  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      // Filter out selection changes based on current mode
      // Deselection is always allowed to pass through normally.
      const filteredChanges = changes.filter((change) => {
        if (change.type === "select" && change.selected) {
          const currentMode = modeRef.current;
          const node = nodesRef.current.find((n) => n.id === change.id);

          // In pan or comment mode, block ALL selection
          if (currentMode === "pan" || currentMode === "comment") {
            return false;
          }

          // In text mode, only allow TextNode selection
          if (currentMode === "text") {
            return node?.type === "TextNode";
          }

          // In select mode, block TextNode and CommentNode selection
          // (they handle their own selection via click handlers)
          if (node?.type === "TextNode" || node?.type === "CommentNode") {
            return false;
          }
        }
        return true;
      });

      // Find all position changes that are currently dragging
      const positionChanges = filteredChanges.filter(
        (
          c,
        ): c is typeof c & {
          type: "position";
          position: { x: number; y: number };
        } => c.type === "position" && c.dragging === true && c.position != null,
      );

      // If multiple nodes are being dragged together (selection drag),
      // we need to move them uniformly - use the first node as reference
      // and apply the same delta to all nodes
      if (positionChanges.length > 1) {
        const refChange = positionChanges[0];
        const refNode = nodesRef.current.find((n) => n.id === refChange.id);

        if (refNode) {
          // Check if any non-comment nodes are being dragged
          const hasNonCommentNodes = positionChanges.some((c) => {
            const node = nodesRef.current.find((n) => n.id === c.id);
            return node?.type !== "CommentNode";
          });

          // Calculate the delta from original position to new position for reference node
          // Only snap delta to grid if dragging non-comment nodes
          const rawDeltaX = refChange.position.x - refNode.position.x;
          const rawDeltaY = refChange.position.y - refNode.position.y;
          const deltaX = hasNonCommentNodes
            ? Math.round(rawDeltaX / GRID_SIZE) * GRID_SIZE
            : rawDeltaX;
          const deltaY = hasNonCommentNodes
            ? Math.round(rawDeltaY / GRID_SIZE) * GRID_SIZE
            : rawDeltaY;

          // Apply the same delta to all dragged nodes uniformly
          const uniformChanges = filteredChanges.map((change) => {
            if (
              change.type !== "position" ||
              !change.dragging ||
              !change.position
            ) {
              return change;
            }

            const node = nodesRef.current.find((n) => n.id === change.id);
            if (!node) return change;

            // Apply uniform delta from reference node
            return {
              ...change,
              position: {
                x: node.position.x + deltaX,
                y: node.position.y + deltaY,
              },
            };
          });

          setNodes((nds) => applyNodeChanges(uniformChanges, nds));
          return;
        }
      }

      // Single node drag - apply grid snap and smart snapping for non-comments
      // Skip snapping during pan-while-drag to avoid jankiness
      const snappedChanges = filteredChanges.map((change) => {
        if (
          change.type !== "position" ||
          !change.dragging ||
          !change.position
        ) {
          return change;
        }

        const node = nodesRef.current.find((n) => n.id === change.id);
        if (!node) return change;

        // Comments move freely - no snapping
        if (node.type === "CommentNode") {
          return change;
        }

        const dragW = node.width ?? 0;
        const dragH = node.height ?? 0;
        const { x, y } = change.position;

        // Apply grid snap first for non-comment nodes
        const gridX = Math.round(x / GRID_SIZE) * GRID_SIZE;
        const gridY = Math.round(y / GRID_SIZE) * GRID_SIZE;

        // Find closest snap positions across visible nodes (smart snapping)
        let closestXDist = SNAP_THRESHOLD;
        let closestYDist = SNAP_THRESHOLD;
        let snapX = gridX;
        let snapY = gridY;

        for (const other of getVisibleNodes()) {
          if (other.id === change.id) continue;

          const otherW = other.width ?? 0;
          const otherH = other.height ?? 0;

          const otherLeft = other.position.x;
          const otherRight = other.position.x + otherW;
          const otherCenterX = other.position.x + otherW / 2;
          const otherTop = other.position.y;
          const otherBottom = other.position.y + otherH;
          const otherCenterY = other.position.y + otherH / 2;

          // Find closest X snap
          for (const { val, adjust } of [
            { val: otherLeft, adjust: 0 },
            { val: otherRight, adjust: 0 },
            { val: otherLeft, adjust: -dragW },
            { val: otherRight, adjust: -dragW },
            { val: otherCenterX, adjust: -dragW / 2 },
          ]) {
            const dist = Math.abs(gridX + adjust - val);
            if (dist < closestXDist) {
              closestXDist = dist;
              snapX = val - adjust;
            }
          }

          // Find closest Y snap
          for (const { val, adjust } of [
            { val: otherTop, adjust: 0 },
            { val: otherBottom, adjust: 0 },
            { val: otherTop, adjust: -dragH },
            { val: otherBottom, adjust: -dragH },
            { val: otherCenterY, adjust: -dragH / 2 },
          ]) {
            const dist = Math.abs(gridY + adjust - val);
            if (dist < closestYDist) {
              closestYDist = dist;
              snapY = val - adjust;
            }
          }
        }

        return { ...change, position: { x: snapX, y: snapY } };
      });

      setNodes((nds) => applyNodeChanges(snappedChanges, nds));
    },
    [getVisibleNodes],
  );

  const handleSelectionChange: OnSelectionChangeFunc = useCallback(
    ({ nodes }) => {
      const newIds = nodes.map((n) => n.id);
      // Update ref IMMEDIATELY so it's always current, even before React re-renders
      selectedNodeIdsRef.current = newIds;
      setSelectedNodeIds(newIds);
    },
    [],
  );

  // Capture selection state and select nodes on mousedown using capture phase
  // This ensures we get the event BEFORE ReactFlow can intercept it
  // Selecting on mousedown (not click) matches Figma's behavior
  // Also sets up "pending drag" state so that immediate scroll-panning moves the node
  useEffect(() => {
    const wrapper = canvasWrapperRef.current;
    if (!wrapper) return;

    const handleMouseDown = (e: MouseEvent) => {
      // always capture the current selection state (for enter-edit-mode detection)
      selectionAtMouseDownRef.current = [...selectedNodeIdsRef.current];

      // dispatch selection state to text nodes so they can detect "second click"
      window.dispatchEvent(
        new CustomEvent("text-node-mousedown-selection", {
          detail: { selectedIds: [...selectedNodeIdsRef.current] },
        }),
      );

      // only select on mousedown in "select" mode with left button
      // don't select if spacebar is held (user is panning)
      // e.button === 0 means left/primary button triggered the event
      // e.buttons & 1 means the primary button is currently pressed
      // Both checks are needed because some trackpad gestures can trigger mousedown
      // with button=0 but buttons=0 (no button actually pressed)
      if (
        mode !== "select" ||
        e.button !== 0 ||
        isSpacebarHeld ||
        !(e.buttons & 1)
      ) {
        return;
      }

      // Debounce: ignore mousedown that happens within 300ms of a mouseup
      // This filters out spurious mousedown events from Mac trackpad touches
      // when the user is trying to start a scroll gesture after releasing a click
      const timeSinceMouseup = Date.now() - lastMouseupTimestampRef.current;
      if (timeSinceMouseup < 300) {
        return;
      }

      // find if user clicked on a node by traversing up to find .react-flow__node
      let target = e.target as HTMLElement | null;
      let nodeId: string | null = null;
      let nodeElement: HTMLElement | null = null;
      while (target && target !== wrapper) {
        if (target.classList?.contains("react-flow__node")) {
          nodeId = target.getAttribute("data-id");
          nodeElement = target;
          break;
        }
        // stop if we hit the pane (clicked on canvas background)
        if (target.classList?.contains("react-flow__pane")) break;
        target = target.parentElement;
      }

      // If no node found via DOM traversal (clicked on pane/background),
      // check if click is geometrically inside a text node's hit-area.
      // This handles clicks in line-height gaps between wrapped text lines,
      // where the inline span doesn't capture the event but we still want
      // the click to work for selection and dragging.
      if (!nodeId) {
        const textNodes = wrapper?.querySelectorAll(
          ".react-flow__node-TextNode",
        );
        if (textNodes) {
          for (const textNode of Array.from(textNodes)) {
            const hitArea = textNode.querySelector(".text-node-hit-area");
            if (hitArea && isClickInTextHitArea(hitArea, e)) {
              nodeId = textNode.getAttribute("data-id");
              nodeElement = textNode as HTMLElement;
              break;
            }
          }
        }
      }

      // If still no node found, handle as pane click
      if (!nodeId) {
        // Use ref to get latest value (avoid stale closure)
        const editingNodeId = currentlyEditingNodeIdRef.current;
        // Check if a TextNode is currently being edited - if so, deselect it
        // The blur event will exit edit mode, and we also deselect the node
        if (editingNodeId) {
          e.stopPropagation();
          // NOTE: Do NOT call preventDefault() - we need blur to fire on the textarea
          // Don't stop the click event - interactive elements (share buttons, etc.) need it

          setNodes((nodes) => nodes.map((n) => ({ ...n, selected: false })));
          return;
        }
        return;
      }

      // check if clicking on something that should NOT trigger selection
      // (e.g., nodrag elements, buttons, inputs)
      // this check must come BEFORE the hit-area check to avoid deselecting when clicking on textarea in edit mode
      const originalTarget = e.target as HTMLElement;
      if (
        originalTarget.closest(".nodrag") ||
        originalTarget.tagName === "BUTTON" ||
        originalTarget.tagName === "INPUT" ||
        originalTarget.tagName === "TEXTAREA"
      ) {
        return;
      }

      // For text nodes, check if click was on the hit-area (actual text content)
      // If click was in dead zone (outside hit-area), treat as canvas click and deselect
      // EXCEPTION: If the node is already selected, skip deadzone check - allow dragging from anywhere
      if (nodeElement?.classList?.contains("react-flow__node-TextNode")) {
        // Skip deadzone check if this node is already selected - allow drag from anywhere
        const isNodeAlreadySelected = selectedNodeIdsRef.current.includes(
          nodeId!,
        );

        if (!isNodeAlreadySelected) {
          const hitArea = nodeElement.querySelector(".text-node-hit-area");
          if (hitArea && !isClickInTextHitArea(hitArea, e)) {
            // Dead zone click - treat as canvas click, deselect all
            // Also start drag-select so user can select other elements
            e.stopPropagation();
            e.preventDefault();

            setNodes((currentNodes) =>
              currentNodes.map((node) => ({ ...node, selected: false })),
            );

            // Set up selection box state for drag-select (same as pane click)
            const canvasWrapper = canvasWrapperRef.current;
            const rfInstance = reactFlowInstanceRef.current;
            if (canvasWrapper && rfInstance) {
              const rect = canvasWrapper.getBoundingClientRect();
              const vp = rfInstance.getViewport();
              const flowX = (e.clientX - rect.left - vp.x) / vp.zoom;
              const flowY = (e.clientY - rect.top - vp.y) / vp.zoom;

              isSelectingRef.current = true;
              selectionStartRef.current = { x: flowX, y: flowY };
              lastMousePosRef.current = { x: e.clientX, y: e.clientY };
            }
            return;
          }
        }
      }

      const isShiftHeld = e.shiftKey;
      const isAlreadySelected = selectedNodeIdsRef.current.includes(nodeId);

      // Determine which nodes will be dragged (before setNodes updates selection)
      // - If clicking an already-selected node or shift-clicking: all selected nodes + clicked node
      // - If clicking an unselected node (without shift): just that node
      const nodesToDragIds: string[] =
        isAlreadySelected || isShiftHeld
          ? [...new Set([...selectedNodeIdsRef.current, nodeId])]
          : [nodeId];

      // ONLY set up pending drag for clicks on UNSELECTED nodes
      // If the node is already selected, don't set up pending drag because:
      // - The click might be accidental (trackpad touch when starting to pan)
      // - The click might be to edit the node
      // - If they want to pan-drag already-selected nodes, they can use normal drag (move mouse first)
      // This prevents the bug where click-to-select + pan accidentally moves the node
      if (!isAlreadySelected) {
        // Set up pending drag state - mouse is held
        // Note: We do NOT set isDraggingNodesRef here - only handleNodeDragStart does that
        isPendingDragRef.current = true;
        draggingNodeIdsRef.current = new Set(nodesToDragIds);
        lastMousePosRef.current = { x: e.clientX, y: e.clientY };

        // Initialize ideal positions from current node positions
        const positions = new Map<string, { x: number; y: number }>();
        for (const node of nodesRef.current) {
          if (nodesToDragIds.includes(node.id)) {
            positions.set(node.id, { x: node.position.x, y: node.position.y });
          }
        }
        idealPositionsRef.current = positions;
      }

      // Select this node immediately (Figma-style mousedown selection)
      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          if (node.id === nodeId) {
            // clicking the node always selects it
            return { ...node, selected: true };
          }
          if (isShiftHeld) {
            // shift-click: keep existing selection, toggle clicked node
            return node;
          }
          if (isAlreadySelected) {
            // clicking an already-selected node: keep multi-selection intact
            // (allows dragging multiple selected nodes)
            return node;
          }
          // normal click on unselected node: deselect others
          return { ...node, selected: false };
        }),
      );
    };

    // Safety net: ensure refs are cleared if mouseup happens without a proper drag end
    // This handles edge cases like clicking without dragging
    const handleMouseUp = () => {
      // Record mouseup time for debouncing spurious mousedown events from trackpad
      lastMouseupTimestampRef.current = Date.now();
      // ALWAYS clear refs on mouseup - mouse is no longer held
      isDraggingNodesRef.current = false;
      isPendingDragRef.current = false;
      idealPositionsRef.current = new Map();
      draggingNodeIdsRef.current = new Set();
      setIsPanDragging(false);
    };

    // Use capture phase to get the event before it can be stopped
    wrapper.addEventListener("mousedown", handleMouseDown, true);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      wrapper.removeEventListener("mousedown", handleMouseDown, true);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [mode, isSpacebarHeld, setNodes, setIsPanDragging]);

  // Handle node click - if node was already selected, dispatch enter-edit-mode
  // Note: TextNodes handle their own edit mode via handleClick (not this handler)
  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      // Use the selection captured at mousedown time, which fires BEFORE
      // blur/focus/selection events. This ensures we know what was selected
      // before this click, even if ReactFlow updates selection before onClick fires.
      const selectionBeforeClick = selectionAtMouseDownRef.current;
      // Clear the ref immediately to prevent reuse by duplicate click events
      // (ReactFlow sometimes fires multiple click events for a single user click)
      selectionAtMouseDownRef.current = [];

      // Text nodes handle their own edit mode - they use the custom
      // text-node-mousedown-selection event to detect "second click"
      if (node.type === "TextNode") {
        return;
      }

      if (selectionBeforeClick.includes(node.id)) {
        window.dispatchEvent(
          new CustomEvent("enter-edit-mode", { detail: { id: node.id } }),
        );
      }
    },
    [],
  );

  const handleClick = useCallback(
    async (event: React.MouseEvent<HTMLDivElement>) => {
      if (!reactFlowInstance) return;

      // In ANY mode, if there's a selected comment, dispatch comment-clicked
      // and return. CommentNode handles shake/close/delete logic.
      if (selectedCommentId) {
        window.dispatchEvent(
          new CustomEvent("comment-clicked", {
            detail: { id: selectedCommentId },
          }),
        );
        return;
      }

      // No selected comment - proceed with mode-specific actions

      // In select or pan mode, don't create anything on click
      if (mode === "select" || mode === "pan") {
        return;
      }

      event.preventDefault();

      const { x, y } = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      if (mode === "comment") {
        // Create a new comment
        const commentId = uuidv4().toString();
        const comment: Comment = {
          created_at: new Date().toISOString(),
          created_by: currentIdentity,
          id: commentId,
          images: [],
          is_deleted: false,
          is_editable: true,
          is_read: true,
          is_submitted: false,
          message: { type: "text", text: "" },
          x,
          y,
        };

        createComment(comment);
        setSelectedCommentId(commentId);

        // defer screenshot capture so comment renders and animates first
        setTimeout(async () => {
          const screenshot = await captureScreenshot({
            reactFlowInstance,
            x: comment.x,
            y: comment.y,
          });

          await updateComments({
            id: comment.id,
            screenshot,
          });
        }, 250);
      } else if (mode === "text") {
        // Commit state before creating text so undo will remove the new element
        commitBeforeChange();

        // Snap position to grid for consistent alignment
        const snappedX = snapToGrid(x);
        const snappedY = snapToGrid(y);

        // Create a new user-created text element
        const textId = `text-${uuidv4()}`;
        const textElement: Element = {
          slot: {
            id: textId,
            content_type: "text",
            description: { type: "text", text: "" },
            height: TEXT_ELEMENT_HEIGHT,
            width: TEXT_ELEMENT_WIDTH,
            x: snappedX,
            y: snappedY,
            source: "user",
          },
          content: {
            type: "text",
            text: "Text",
          },
        };

        // Mark this node to be selected when it appears
        pendingSelectionRef.current.add(textId);

        // Switch back to select mode and create the element
        setMode("select");
        await updateElements([textElement]);
      }
    },
    [
      reactFlowInstance,
      selectedCommentId,
      setSelectedCommentId,
      createComment,
      updateElements,
      updateComments,
      mode,
      setMode,
      commitBeforeChange,
    ],
  );

  // Commit state before drag starts so undo will restore pre-drag position
  const handleNodeDragStart: NodeDragHandler = useCallback(
    (_event, node, nodes) => {
      // Clear any stale helper lines from previous drag
      setHelperLineH(null);
      setHelperLineV(null);

      // Set up drag state - this is when pan-while-drag becomes active
      // (ReactFlow fires this after mouse moves past 5px threshold)
      draggingNodeIdsRef.current = new Set(nodes.map((n) => n.id));
      isDraggingNodesRef.current = true;
      isPendingDragRef.current = false;
      setIsDraggingNodes(true);

      // Initialize ideal positions with current node positions
      const newPositions = new Map<string, { x: number; y: number }>();
      for (const n of nodes) {
        newPositions.set(n.id, { x: n.position.x, y: n.position.y });
      }
      idealPositionsRef.current = newPositions;

      commitBeforeChange();
    },
    [commitBeforeChange],
  );

  // Calculate alignment helper lines during drag
  const handleNodeDrag: NodeDragHandler = useCallback(
    (event, draggedNode, draggedNodes) => {
      // Update mouse position for pan-while-drag calculations
      lastMousePosRef.current = { x: event.clientX, y: event.clientY };

      // Update idealPositionsRef with current positions from ReactFlow
      // This ensures finalizeDrag has the correct positions for regular mouse drags
      // (pan-while-drag updates this via the scroll handler, but regular drag needs this)
      for (const n of draggedNodes) {
        idealPositionsRef.current.set(n.id, { ...n.position });
      }

      // Don't show helper lines during pan-while-drag
      if (isPanningDuringDragRef.current) {
        setHelperLineH(null);
        setHelperLineV(null);
        return;
      }

      // Comments don't show alignment helper lines
      if (draggedNode.type === "CommentNode") {
        setHelperLineH(null);
        setHelperLineV(null);
        return;
      }

      // Build set of all dragging node IDs to exclude from alignment targets
      const draggingIds = new Set(draggedNodes.map((n) => n.id));

      // Calculate alignment using visible nodes only (performance optimization)
      const { helperLineH, helperLineV } = calculateAlignment(
        draggedNode.position,
        draggedNode.width ?? 0,
        draggedNode.height ?? 0,
        draggingIds,
        getVisibleNodes(),
      );

      setHelperLineH(helperLineH);
      setHelperLineV(helperLineV);
    },
    [getVisibleNodes],
  );

  // Commit state before SELECTION drag starts (when dragging multiple selected nodes)
  const handleSelectionDragStart: SelectionDragHandler = useCallback(
    (_event, nodes) => {
      // Clear any stale helper lines from previous drag
      setHelperLineH(null);
      setHelperLineV(null);

      // Set up drag state - this is when pan-while-drag becomes active
      // (ReactFlow fires this after mouse moves past 5px threshold)
      draggingNodeIdsRef.current = new Set(nodes.map((n) => n.id));
      isDraggingNodesRef.current = true;
      isPendingDragRef.current = false;
      setIsDraggingNodes(true);

      // Initialize ideal positions with current node positions
      const newPositions = new Map<string, { x: number; y: number }>();
      for (const n of nodes) {
        newPositions.set(n.id, { x: n.position.x, y: n.position.y });
      }
      idealPositionsRef.current = newPositions;

      commitBeforeChange();
    },
    [commitBeforeChange],
  );

  // Update idealPositionsRef during selection drag (for regular mouse drags)
  const handleSelectionDrag: SelectionDragHandler = useCallback(
    (event, nodes) => {
      // Update mouse position for pan-while-drag calculations
      lastMousePosRef.current = { x: event.clientX, y: event.clientY };

      // Update idealPositionsRef with current positions from ReactFlow
      for (const n of nodes) {
        idealPositionsRef.current.set(n.id, { ...n.position });
      }
    },
    [],
  );

  const processDraggedNodes = useCallback(
    async (draggedNodes: Node[]) => {
      const elementsById = new Map(layout.elements.map((e) => [e.slot.id, e]));
      const commentsById = new Map(layout.comments.map((c) => [c.id, c]));

      const elementsToUpdate: Element[] = [];
      const commentUpdates: Promise<void>[] = [];

      for (const draggedNode of draggedNodes) {
        const x = Math.round(draggedNode.position.x);
        const y = Math.round(draggedNode.position.y);

        const comment = commentsById.get(draggedNode.id);
        if (comment) {
          commentUpdates.push(
            captureScreenshot({ reactFlowInstance, x, y }).then((screenshot) =>
              updateComments({ id: comment.id, x, y, screenshot }),
            ),
          );
          continue;
        }

        const element = elementsById.get(draggedNode.id);
        if (element) {
          elementsToUpdate.push({
            ...element,
            slot: { ...element.slot, x, y },
          });
        }
      }

      if (elementsToUpdate.length > 0) {
        await updateElements(elementsToUpdate, {
          preserveExistingPositions: false,
        });
      }

      if (commentUpdates.length > 0) {
        await Promise.all(commentUpdates);
      }
    },
    [layout, updateComments, updateElements, reactFlowInstance],
  );

  const finalizeDrag = useCallback(
    async (draggedNodes: Node[]) => {
      // IMPORTANT: Get the TRUE current positions from idealPositionsRef BEFORE clearing it!
      // This is the most accurate source because we update it synchronously during pan-while-drag.
      // nodesRef.current can be stale if setNodes hasn't been rendered yet.
      // ReactFlow's draggedNodes is also stale (doesn't know about our setNodes calls).
      const nodesWithCurrentPositions = draggedNodes.map((n) => {
        const idealPos = idealPositionsRef.current.get(n.id);
        if (idealPos) {
          // Use ideal position (snapped to grid for non-comments)
          const snappedX =
            n.type === "CommentNode"
              ? idealPos.x
              : Math.round(idealPos.x / GRID_SIZE) * GRID_SIZE;
          const snappedY =
            n.type === "CommentNode"
              ? idealPos.y
              : Math.round(idealPos.y / GRID_SIZE) * GRID_SIZE;
          return { ...n, position: { x: snappedX, y: snappedY } };
        }
        // Fallback to nodesRef if no ideal position (shouldn't happen during pan-while-drag)
        const current = nodesRef.current.find((node) => node.id === n.id);
        return current ? { ...n, position: current.position } : n;
      });

      setHelperLineH(null);
      setHelperLineV(null);

      // IMPORTANT: Set savedPositionsRef BEFORE clearing idealPositionsRef
      // This creates a protection window - during this time, layout sync
      // will use the saved position unconditionally, ignoring any stale SSE updates.
      // Undo/redo explicitly clears this via a capture-phase keyboard listener.
      const protectedUntil = Date.now() + 1000; // 1 second protection window
      for (const node of nodesWithCurrentPositions) {
        const savedPos = {
          x: Math.round(node.position.x),
          y: Math.round(node.position.y),
          protectedUntil,
        };
        savedPositionsRef.current.set(node.id, savedPos);
      }

      // NOW we can clear the ideal positions after capturing them
      isDraggingNodesRef.current = false;
      setIsDraggingNodes(false);
      setIsPanDragging(false);
      idealPositionsRef.current = new Map();

      // Use the corrected positions, not ReactFlow's stale ones
      await processDraggedNodes(nodesWithCurrentPositions);

      // Clear dragging state
      draggingNodeIdsRef.current = new Set();

      // Clean up saved positions after the protection window expires
      setTimeout(() => {
        const now = Date.now();
        for (const [id, saved] of savedPositionsRef.current) {
          if (now > saved.protectedUntil) {
            savedPositionsRef.current.delete(id);
          }
        }
      }, 1500); // Clean up shortly after 1 second protection expires
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- savedPositionsRef is stable (ref from context)
    [processDraggedNodes, setIsPanDragging],
  );

  const handleNodeDragStop: NodeDragHandler = useCallback(
    async (_event, _node, draggedNodes) => finalizeDrag(draggedNodes),
    [finalizeDrag],
  );

  // Handle selection drag stop (when dragging multiple selected nodes)
  const handleSelectionDragStop: SelectionDragHandler = useCallback(
    async (_event, draggedNodes) => finalizeDrag(draggedNodes),
    [finalizeDrag],
  );

  // Compute mode-based props
  const reactFlowProps = useMemo(() => {
    switch (mode) {
      case "select":
        return {
          // disable node dragging when spacebar is held to allow panning
          nodesDraggable: !isSpacebarHeld,
          elementsSelectable: true,
          panOnDrag: [1, 2] as number[], // middle and right mouse buttons only
          selectionOnDrag: false, // We use custom selection for pan-while-selecting
          // We handle delete ourselves to avoid race condition when exiting text edit mode
          deleteKeyCode: null,
        };
      case "pan":
        return {
          nodesDraggable: false,
          elementsSelectable: false,
          panOnDrag: true,
          selectionOnDrag: false,
          deleteKeyCode: null,
        };
      case "comment":
      case "text":
      default:
        return {
          nodesDraggable: false,
          elementsSelectable: false,
          panOnDrag: [1, 2] as number[], // middle and right mouse buttons only
          selectionOnDrag: false,
          deleteKeyCode: null,
        };
    }
  }, [mode, isSpacebarHeld]);

  // Handle node deletion (syncs ReactFlow deletion with layout state)
  const handleNodesDelete = useCallback(
    async (deletedNodes: Node[]) => {
      // Commit state before deletion so undo will restore deleted elements
      commitBeforeChange();

      const elementIds = deletedNodes
        .map((n) => n.id)
        .filter((id) => layout.elements.some((e) => e.slot.id === id));

      const commentIds = deletedNodes
        .map((n) => n.id)
        .filter((id) => layout.comments.some((c) => c.id === id));

      if (elementIds.length > 0) {
        await deleteElements(elementIds);
      }

      if (commentIds.length > 0) {
        // If any deleted comment was selected, deselect it
        if (selectedCommentId && commentIds.includes(selectedCommentId)) {
          setSelectedCommentId(null);
        }
        await updateComments(
          ...commentIds.map((id) => ({
            id,
            is_deleted: true,
          })),
        );
      }
    },
    [
      layout.elements,
      layout.comments,
      deleteElements,
      updateComments,
      commitBeforeChange,
      selectedCommentId,
      setSelectedCommentId,
    ],
  );

  // Handle Delete/Backspace key ourselves to avoid race condition with ReactFlow
  // When exiting text edit mode by clicking outside, setNodes() is async.
  // If Delete is pressed before React re-renders, ReactFlow might not see the
  // node as selected. By handling delete ourselves using nodesRef (which has
  // the previous render's nodes with correct selection), we avoid this issue.
  useEffect(() => {
    const handleDeleteKey = (e: KeyboardEvent) => {
      // Only handle in select mode
      if (modeRef.current !== "select") return;

      // Only handle Backspace and Delete keys
      if (e.key !== "Backspace" && e.key !== "Delete") return;

      // Don't delete if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        return;
      }

      // Get selected nodes from our ref (which reflects current React state)
      const selectedNodes = nodesRef.current.filter((n) => n.selected);
      if (selectedNodes.length === 0) return;

      e.preventDefault();
      e.stopPropagation();

      // Call our delete handler directly
      handleNodesDelete(selectedNodes);
    };

    // Use capture phase to run before ReactFlow's handler
    window.addEventListener("keydown", handleDeleteKey, { capture: true });

    return () => {
      window.removeEventListener("keydown", handleDeleteKey, { capture: true });
    };
  }, [handleNodesDelete]);

  // Handle Escape key - same as clicking the canvas: blur, deselect, clear selection
  useEffect(() => {
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;

      // Blur active element (exits edit mode via handleBlur, like clicking canvas)
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }

      // Clear native browser text selection (the "blue box")
      window.getSelection()?.removeAllRanges();

      // Deselect all nodes and close any comment after blur effects settle
      requestAnimationFrame(() => {
        setNodes((nodes) => nodes.map((n) => ({ ...n, selected: false })));
        if (selectedCommentIdRef.current) {
          setSelectedCommentId(null);
        }
      });
    };

    window.addEventListener("keydown", handleEscapeKey);
    return () => window.removeEventListener("keydown", handleEscapeKey);
  }, [setNodes, setSelectedCommentId]);

  // Copy selected elements to clipboard (both internal and system clipboard)
  // Paste elements from clipboard with smart positioning
  const handlePaste = useCallback(() => {
    const copiedElements = getClipboard();
    if (copiedElements.length === 0) return;

    // Get viewport bounds in flow coordinates
    const container = document.querySelector(".canvas-wrapper");
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const topLeft = reactFlowInstance.screenToFlowPosition({ x: 0, y: 0 });
    const bottomRight = reactFlowInstance.screenToFlowPosition({
      x: rect.width,
      y: rect.height,
    });

    // Check if any copied element is in viewport
    const isElementInViewport = (el: Element): boolean => {
      const { x, y, width, height } = el.slot;
      // Check if element's bounding box intersects with viewport
      return !(
        x + width < topLeft.x ||
        x > bottomRight.x ||
        y + height < topLeft.y ||
        y > bottomRight.y
      );
    };

    const anyInView = copiedElements.some(isElementInViewport);

    let offsetX: number;
    let offsetY: number;

    if (anyInView) {
      // Option 1: At least one element is visible - offset by 200px
      offsetX = 200;
      offsetY = 200;
    } else {
      // Option 2: No elements visible - center at viewport center
      // Calculate bounding box of copied elements
      const minX = Math.min(...copiedElements.map((el) => el.slot.x));
      const minY = Math.min(...copiedElements.map((el) => el.slot.y));
      const maxX = Math.max(
        ...copiedElements.map((el) => el.slot.x + el.slot.width),
      );
      const maxY = Math.max(
        ...copiedElements.map((el) => el.slot.y + el.slot.height),
      );

      const bboxCenterX = (minX + maxX) / 2;
      const bboxCenterY = (minY + maxY) / 2;

      // Calculate viewport center in flow coordinates
      const viewportCenterX = (topLeft.x + bottomRight.x) / 2;
      const viewportCenterY = (topLeft.y + bottomRight.y) / 2;

      // Offset to move bbox center to viewport center
      offsetX = viewportCenterX - bboxCenterX;
      offsetY = viewportCenterY - bboxCenterY;
    }

    // Generate new IDs and apply offset
    // Always set source: "user" for pasted elements because:
    // 1. The paste action itself is user-initiated and should be undoable
    // 2. Pasted content is already loaded, so no loading states needed
    const newElements: Element[] = copiedElements.map((el) => {
      const newId = `pasted-${uuidv4()}`;

      return {
        ...el,
        slot: {
          ...el.slot,
          id: newId,
          x: el.slot.x + offsetX,
          y: el.slot.y + offsetY,
          source: "user" as const,
        },
      };
    });

    // Commit state for undo support
    commitBeforeChange();

    // Add the new elements (don't await - cache updates synchronously,
    // and we want to update selection immediately)
    updateElements(newElements);

    // Update clipboard with the newly pasted elements so subsequent pastes
    // will offset from these new positions (not the original copied positions)
    setClipboard(newElements);

    // Select only the pasted elements (use requestAnimationFrame to ensure
    // this runs after the layout sync effect updates the nodes)
    const pastedIds = new Set(newElements.map((el) => el.slot.id));

    requestAnimationFrame(() => {
      setNodes((currentNodes) =>
        currentNodes.map((node) => ({
          ...node,
          selected: pastedIds.has(node.id),
        })),
      );
    });
  }, [reactFlowInstance, commitBeforeChange, updateElements]);

  /* Share selected elements in a new page (disabled - button removed from UI)
  const handleShareInNewPage = useCallback(async () => {
    // Get the selected elements
    const selectedElements = layout.elements.filter((el) =>
      selectedNodeIds.includes(el.slot.id),
    );
    if (selectedElements.length === 0) return;

    // Calculate bounding box to normalize positions
    const minX = Math.min(...selectedElements.map((el) => el.slot.x));
    const minY = Math.min(...selectedElements.map((el) => el.slot.y));

    // Normalize positions so they start at a reasonable origin (100, 100)
    const normalizedElements: Element[] = selectedElements.map((el) => ({
      ...el,
      slot: {
        ...el.slot,
        id: `pasted-${uuidv4()}`,
        x: el.slot.x - minX + 100,
        y: el.slot.y - minY + 100,
        source: "user" as const,
      },
    }));

    // Store in clipboard
    setClipboard(normalizedElements);

    // Create a new design page
    const design = await createDesign({
      problem: [],
      title: `Page ${designs.length + 1}`,
    });

    // Navigate to the new page with paste flag
    navigate(`/design/${design.id}?paste=true`);
  }, [
    layout.elements,
    selectedNodeIds,
    createDesign,
    designs.length,
    navigate,
  ]); */

  // Copy/paste: use native clipboard events so macOS menu bar flashes
  useEffect(() => {
    const onCopy = (e: ClipboardEvent) => {
      // Skip if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        return;
      }

      const selectedElements = layout.elements.filter((el) =>
        selectedNodeIds.includes(el.slot.id),
      );
      if (selectedElements.length === 0) return;

      e.preventDefault();

      // Store elements directly in clipboard as JSON text
      // When user copies from desktop, this gets replaced
      // So on paste, if this data exists, it's from canvas; if not, check for images
      e.clipboardData?.setData(
        "text/plain",
        `__ORIANNA_ELEMENTS__${JSON.stringify(selectedElements)}`,
      );

      // Also store in sessionStorage for cross-tab paste
      setClipboard(selectedElements);

      // Clear image paste tracking since user is doing a new canvas copy
      lastImagePasteRef.current = null;
    };

    const onPaste = async (e: ClipboardEvent) => {
      // Skip if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        return;
      }

      // Check clipboard text for our marker (canvas copy)
      // If user copied from desktop, this marker is gone (replaced by desktop content)
      const textData = e.clipboardData?.getData("text/plain") || "";
      if (textData.startsWith("__ORIANNA_ELEMENTS__")) {
        e.preventDefault();
        try {
          const elementsJson = textData.replace("__ORIANNA_ELEMENTS__", "");
          const elements = JSON.parse(elementsJson) as Element[];
          if (elements.length > 0) {
            // Only initialize sessionStorage if it's empty (e.g., page refresh)
            // Otherwise, use existing sessionStorage which has updated positions from previous pastes
            if (getClipboard().length === 0) {
              setClipboard(elements);
            }
            handlePaste();
            return;
          }
        } catch {
          // Invalid JSON, fall through to image handling
        }
      }

      // No canvas data in clipboard - check for images (desktop/Finder copy)
      const imageFiles: File[] = [];

      if (e.clipboardData?.items) {
        for (const item of Array.from(e.clipboardData.items)) {
          if (item.type.startsWith("image/")) {
            const file = item.getAsFile();
            if (file) {
              imageFiles.push(file);
            }
          }
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault();

        const container = document.querySelector(".canvas-wrapper");
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const topLeft = reactFlowInstance.screenToFlowPosition({
          x: rect.left,
          y: rect.top,
        });
        const bottomRight = reactFlowInstance.screenToFlowPosition({
          x: rect.left + rect.width,
          y: rect.top + rect.height,
        });

        // Check if previous image paste position is in viewport
        const lastPaste = lastImagePasteRef.current;
        const isPrevInViewport =
          lastPaste &&
          !(
            lastPaste.x + DROPPED_IMAGE_WIDTH < topLeft.x ||
            lastPaste.x > bottomRight.x ||
            lastPaste.y + DROPPED_IMAGE_HEIGHT < topLeft.y ||
            lastPaste.y > bottomRight.y
          );

        let pasteX: number;
        let pasteY: number;

        if (isPrevInViewport && lastPaste) {
          // Previous image paste is in view - offset by 200px
          pasteX = lastPaste.x + 200;
          pasteY = lastPaste.y + 200;
        } else {
          // No previous paste or not in view - center in viewport
          const centerScreen = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          };
          const centerFlow =
            reactFlowInstance.screenToFlowPosition(centerScreen);
          pasteX = snapToGrid(centerFlow.x);
          pasteY = snapToGrid(centerFlow.y);
        }

        commitBeforeChange();

        // Create placeholder elements immediately (with empty URL)
        const placeholderElements: Element[] = imageFiles.map((_, i) => ({
          slot: {
            id: `user-input-img-${uuidv4()}`,
            x: pasteX + i * (DROPPED_IMAGE_WIDTH + DROPPED_IMAGE_GAP),
            y: pasteY,
            width: DROPPED_IMAGE_WIDTH,
            height: DROPPED_IMAGE_HEIGHT,
            content_type: "image" as const,
            description: { type: "text" as const, text: "" },
            source: "user" as const,
          },
          content: { type: "image" as const, url: "" },
        }));

        // Show placeholders immediately
        await updateElements(placeholderElements);
        lastImagePasteRef.current = { x: pasteX, y: pasteY };

        // Upload files in background and update elements with real URLs
        for (let i = 0; i < imageFiles.length; i++) {
          const file = imageFiles[i];
          const placeholder = placeholderElements[i];
          try {
            const url = await DRIVE_CLIENT.upload(file);
            // Update the placeholder with the real URL
            await updateElements([
              {
                ...placeholder,
                content: { type: "image", url },
              },
            ]);
          } catch {
            // Failed to upload - show error state
            await updateElements([
              {
                ...placeholder,
                content: { type: "image", url: "error:upload-failed" },
              },
            ]);
          }
        }
      }
    };

    window.addEventListener("copy", onCopy);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("copy", onCopy);
      window.removeEventListener("paste", onPaste);
    };
  }, [
    layout.elements,
    selectedNodeIds,
    handlePaste,
    reactFlowInstance,
    commitBeforeChange,
    updateElements,
  ]);

  // Handle file drag and drop onto canvas
  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;

    // Check if dragging files (not internal nodes)
    if (e.dataTransfer.types.includes("Files")) {
      setIsDraggingFile(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;

    if (dragCounterRef.current === 0) {
      setIsDraggingFile(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    // Set the drop effect to copy for visual feedback
    if (e.dataTransfer.types.includes("Files")) {
      e.dataTransfer.dropEffect = "copy";
    }
  }, []);

  const handleFileDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;

      const files = e.dataTransfer.files;
      if (!files || files.length === 0) {
        setIsDraggingFile(false);
        return;
      }

      // Filter for valid image files
      const validFiles = Array.from(files).filter((file) =>
        ALLOWED_IMAGE_TYPES.includes(file.type.toLowerCase()),
      );

      if (validFiles.length === 0) {
        setIsDraggingFile(false);
        return;
      }

      // Get drop position in flow coordinates, snapped to grid
      const rawDropPosition = reactFlowInstance.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });
      const dropPosition = {
        x: snapToGrid(rawDropPosition.x),
        y: snapToGrid(rawDropPosition.y),
      };

      // Commit state before adding images so undo will remove them
      commitBeforeChange();

      // Create placeholder elements immediately (with empty URL)
      const placeholderElements: Element[] = validFiles.map((_, i) => {
        const imageId = `user-input-img-${uuidv4()}`;
        pendingSelectionRef.current.add(imageId);
        return {
          slot: {
            id: imageId,
            x: dropPosition.x + i * (DROPPED_IMAGE_WIDTH + DROPPED_IMAGE_GAP),
            y: dropPosition.y,
            width: DROPPED_IMAGE_WIDTH,
            height: DROPPED_IMAGE_HEIGHT,
            content_type: "image" as const,
            description: { type: "text" as const, text: "" },
            source: "user" as const,
          },
          content: { type: "image" as const, url: "" },
        };
      });

      // Show placeholders immediately
      await updateElements(placeholderElements);
      setIsDraggingFile(false);

      // Upload files in background and update elements with real URLs
      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        const placeholder = placeholderElements[i];
        try {
          const url = await DRIVE_CLIENT.upload(file);
          await updateElements([
            {
              ...placeholder,
              content: { type: "image", url },
            },
          ]);
        } catch {
          // Failed to upload - show error state
          await updateElements([
            {
              ...placeholder,
              content: { type: "image", url: "error:upload-failed" },
            },
          ]);
        }
      }
    },
    [reactFlowInstance, commitBeforeChange, updateElements],
  );

  // Custom selection box logic (supports pan-while-selecting like Figma)
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Update selection box when viewport changes (enables pan-while-selecting)
  useEffect(() => {
    if (!isSelectingRef.current || !selectionStartRef.current) return;

    const wrapper = canvasWrapperRef.current;
    if (!wrapper) return;

    // Recalculate current position in flow coordinates (manual calc, no snapping)
    const rect = wrapper.getBoundingClientRect();
    const [tx, ty, scale] = transform;
    const relativeX = lastMousePosRef.current.x - rect.left;
    const relativeY = lastMousePosRef.current.y - rect.top;

    setSelectionBox({
      startX: selectionStartRef.current.x,
      startY: selectionStartRef.current.y,
      currentX: (relativeX - tx) / scale,
      currentY: (relativeY - ty) / scale,
    });
  }, [transform]);

  // Track previous transform for pan-while-drag calculations
  const prevTransformRef = useRef(transform);

  // Update dragged node positions when viewport pans (enables pan-while-drag like Figma)
  // useLayoutEffect runs synchronously before paint, eliminating visual lag during fast scrolling
  useLayoutEffect(() => {
    // Only run if we're ACTIVELY dragging nodes (ReactFlow's onNodeDragStart has fired)
    // We intentionally do NOT support pan-while-drag in "pending" state (mouse down but not
    // moved past 5px threshold) because it's too error-prone - it's impossible to reliably
    // distinguish "click then pan" from "click-hold then pan" due to event timing issues
    if (!isDraggingNodesRef.current) {
      return;
    }

    // Extra safeguard: if there are no ideal positions to update, nothing to do
    // This handles edge cases where refs weren't properly cleared (e.g., missed mouseup)
    if (idealPositionsRef.current.size === 0) {
      return;
    }

    const wrapper = canvasWrapperRef.current;
    if (!wrapper) return;

    const prevT = prevTransformRef.current;
    const [tx, ty, scale] = transform;
    const [prevTx, prevTy, prevScale] = prevT;

    // Skip if no change (prevents initial render from triggering)
    if (tx === prevTx && ty === prevTy && scale === prevScale) return;

    // Calculate how much the viewport shifted in screen coordinates
    // When viewport pans right (tx increases), nodes visually move left
    // To keep nodes under cursor, we need to shift their flow position
    const rect = wrapper.getBoundingClientRect();
    const mouseScreen = lastMousePosRef.current;

    // Convert mouse position to flow coordinates using OLD transform
    const oldFlowX = (mouseScreen.x - rect.left - prevTx) / prevScale;
    const oldFlowY = (mouseScreen.y - rect.top - prevTy) / prevScale;

    // Convert mouse position to flow coordinates using NEW transform
    const newFlowX = (mouseScreen.x - rect.left - tx) / scale;
    const newFlowY = (mouseScreen.y - rect.top - ty) / scale;

    // Delta in flow coordinates - how much the "point under cursor" shifted
    const deltaX = newFlowX - oldFlowX;
    const deltaY = newFlowY - oldFlowY;

    // If no meaningful delta, skip
    if (Math.abs(deltaX) < 0.01 && Math.abs(deltaY) < 0.01) return;

    // Mark that we're panning during drag (suppresses helper lines in handleNodeDrag)
    isPanningDuringDragRef.current = true;

    // Signal to nodes that pan-drag is active (for hiding toolbars)
    setIsPanDragging(true);

    // Update ideal positions
    for (const [nodeId, pos] of idealPositionsRef.current) {
      idealPositionsRef.current.set(nodeId, {
        x: pos.x + deltaX,
        y: pos.y + deltaY,
      });
    }

    // Update visual node positions
    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        const idealPos = idealPositionsRef.current.get(node.id);
        if (!idealPos) return node;

        // Comments move freely, non-comments snap to grid
        const snappedX =
          node.type === "CommentNode"
            ? idealPos.x
            : Math.round(idealPos.x / GRID_SIZE) * GRID_SIZE;
        const snappedY =
          node.type === "CommentNode"
            ? idealPos.y
            : Math.round(idealPos.y / GRID_SIZE) * GRID_SIZE;

        return { ...node, position: { x: snappedX, y: snappedY } };
      }),
    );

    // For slow panning, recalculate alignment; for fast panning, clear lines
    // This matches FigJam behavior where slow careful positioning shows guides
    const panSpeed = Math.max(Math.abs(deltaX), Math.abs(deltaY));
    if (panSpeed < SNAP_THRESHOLD) {
      // Slow pan - recalculate alignment for first dragging node
      const draggingIds = draggingNodeIdsRef.current;
      const firstDraggingId = draggingIds.values().next().value;
      if (firstDraggingId) {
        const node = nodesRef.current.find((n) => n.id === firstDraggingId);
        if (node && node.type !== "CommentNode") {
          const idealPos = idealPositionsRef.current.get(firstDraggingId);
          if (idealPos) {
            const { helperLineH, helperLineV } = calculateAlignment(
              idealPos,
              node.width ?? 0,
              node.height ?? 0,
              draggingIds,
              getVisibleNodes(),
            );
            setHelperLineH(helperLineH);
            setHelperLineV(helperLineV);
          }
        }
      }
    } else {
      // Fast pan - clear lines to avoid visual noise
      setHelperLineH(null);
      setHelperLineV(null);
    }

    // Reset panning flag after update
    isPanningDuringDragRef.current = false;
  }, [transform, setNodes, getVisibleNodes, setIsPanDragging]);

  // Update prevTransformRef after the pan-while-drag effect runs
  useEffect(() => {
    prevTransformRef.current = transform;
  }, [transform]);

  // Select nodes that intersect with the selection box
  useEffect(() => {
    if (!selectionBox || !reactFlowInstance) return;

    const minX = Math.min(selectionBox.startX, selectionBox.currentX);
    const maxX = Math.max(selectionBox.startX, selectionBox.currentX);
    const minY = Math.min(selectionBox.startY, selectionBox.currentY);
    const maxY = Math.max(selectionBox.startY, selectionBox.currentY);

    // Find nodes that intersect with selection box (partial intersection)
    const selectedIds = new Set<string>();
    for (const node of nodesRef.current) {
      // For text nodes, check intersection with the hit area (actual text bounds)
      // not the full slot bounds
      if (node.type === "TextNode") {
        // Find the hit area element
        const nodeElement = document.querySelector(
          `.react-flow__node[data-id="${node.id}"] .text-node-hit-area`,
        );
        if (nodeElement) {
          // Get hit area bounds in screen coordinates
          const rect = nodeElement.getBoundingClientRect();
          // Convert to flow coordinates
          const topLeft = reactFlowInstance.screenToFlowPosition({
            x: rect.left,
            y: rect.top,
          });
          const bottomRight = reactFlowInstance.screenToFlowPosition({
            x: rect.right,
            y: rect.bottom,
          });

          const intersects =
            topLeft.x < maxX &&
            bottomRight.x > minX &&
            topLeft.y < maxY &&
            bottomRight.y > minY;

          if (intersects) {
            selectedIds.add(node.id);
          }
        }
        continue;
      }

      // Skip comment nodes from drag-to-select (they're not content)
      if (node.type === "CommentNode") {
        continue;
      }

      // For non-text nodes, use the full bounds
      const nodeLeft = node.position.x;
      const nodeRight = node.position.x + (node.width ?? 0);
      const nodeTop = node.position.y;
      const nodeBottom = node.position.y + (node.height ?? 0);

      // Check for intersection (not containment)
      const intersects =
        nodeLeft < maxX &&
        nodeRight > minX &&
        nodeTop < maxY &&
        nodeBottom > minY;

      if (intersects) {
        selectedIds.add(node.id);
      }
    }

    // Update node selection
    setNodes((currentNodes) =>
      currentNodes.map((node) => ({
        ...node,
        selected: selectedIds.has(node.id),
      })),
    );
  }, [selectionBox, reactFlowInstance]);

  // Sync selection box dragging state to global atom (for ImageNode to suppress share button flash)
  useEffect(() => {
    setIsSelectionBoxDragging(selectionBox !== null);
  }, [selectionBox, setIsSelectionBoxDragging]);

  // Mouse handlers for custom selection (pan-while-selecting like Figma)
  const autoPanRef = useRef<number | null>(null);

  useEffect(() => {
    if (mode !== "select") return;

    const wrapper = canvasWrapperRef.current;
    if (!wrapper) return;

    const EDGE_THRESHOLD = 40; // px from edge to trigger auto-pan
    const PAN_SPEED = 8; // px per frame

    // Inline coordinate conversion to avoid dependency on transform
    const getFlowPos = (screenX: number, screenY: number) => {
      const rect = wrapper.getBoundingClientRect();
      const vp = reactFlowInstance.getViewport();
      const relativeX = screenX - rect.left;
      const relativeY = screenY - rect.top;
      return {
        x: (relativeX - vp.x) / vp.zoom,
        y: (relativeY - vp.y) / vp.zoom,
      };
    };

    const startAutoPan = () => {
      if (autoPanRef.current) return;

      const tick = () => {
        if (!isSelectingRef.current) {
          stopAutoPan();
          return;
        }

        const rect = wrapper.getBoundingClientRect();
        const { x: mouseX, y: mouseY } = lastMousePosRef.current;
        let dx = 0;
        let dy = 0;

        // Check if cursor is near or past edges
        if (mouseX < rect.left + EDGE_THRESHOLD) {
          dx = PAN_SPEED;
        } else if (mouseX > rect.right - EDGE_THRESHOLD) {
          dx = -PAN_SPEED;
        }

        if (mouseY < rect.top + EDGE_THRESHOLD) {
          dy = PAN_SPEED;
        } else if (mouseY > rect.bottom - EDGE_THRESHOLD) {
          dy = -PAN_SPEED;
        }

        if (dx !== 0 || dy !== 0) {
          const vp = reactFlowInstance.getViewport();
          reactFlowInstance.setViewport({
            x: vp.x + dx,
            y: vp.y + dy,
            zoom: vp.zoom,
          });
        }

        autoPanRef.current = requestAnimationFrame(tick);
      };

      autoPanRef.current = requestAnimationFrame(tick);
    };

    const stopAutoPan = () => {
      if (autoPanRef.current) {
        cancelAnimationFrame(autoPanRef.current);
        autoPanRef.current = null;
      }
    };

    let hasDragged = false;

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return; // Left click only
      const target = e.target as HTMLElement;
      if (!target.classList.contains("react-flow__pane")) return;

      // Check if a text input is focused - if so, let the click blur it naturally
      const activeEl = document.activeElement;
      const isTextFocused =
        activeEl instanceof HTMLTextAreaElement ||
        activeEl instanceof HTMLInputElement;
      if (!isTextFocused) {
        // Prevent text selection when dragging outside canvas
        e.preventDefault();
      } else {
        // When a text input is focused (e.g., comment textarea), clicking the canvas
        // to blur it will consume the click event - onClick won't fire.
        // Dispatch comment-clicked so CommentNode can handle shake/close/delete logic.
        const currentSelectedCommentId = selectedCommentIdRef.current;
        if (currentSelectedCommentId) {
          window.dispatchEvent(
            new CustomEvent("comment-clicked", {
              detail: { id: currentSelectedCommentId },
            }),
          );
        }
      }

      const flowPos = getFlowPos(e.clientX, e.clientY);

      isSelectingRef.current = true;
      selectionStartRef.current = flowPos;
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
      hasDragged = false;

      // Don't show selection box or start auto-pan until mouse moves
    };

    const handleMouseMove = (e: MouseEvent) => {
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };

      if (!isSelectingRef.current || !selectionStartRef.current) return;

      hasDragged = true;
      const flowPos = getFlowPos(e.clientX, e.clientY);

      setSelectionBox({
        startX: selectionStartRef.current.x,
        startY: selectionStartRef.current.y,
        currentX: flowPos.x,
        currentY: flowPos.y,
      });

      // Start auto-pan once dragging begins
      startAutoPan();
    };

    const handleMouseUp = () => {
      isSelectingRef.current = false;
      selectionStartRef.current = null;
      setSelectionBox(null);
      stopAutoPan();
    };

    // Prevent ReactFlow from clearing selection when we finish a drag-select
    const handleClick = (e: MouseEvent) => {
      if (hasDragged) {
        e.stopPropagation();
        hasDragged = false;
      }
    };

    wrapper.addEventListener("mousedown", handleMouseDown);
    wrapper.addEventListener("click", handleClick, true); // Capture phase
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      wrapper.removeEventListener("mousedown", handleMouseDown);
      wrapper.removeEventListener("click", handleClick, true);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      stopAutoPan();
    };
  }, [mode, reactFlowInstance, updateComments]);

  // Calculate bounding box for multi-selection
  const multiSelectionBounds = useMemo(() => {
    const selectedNodes = nodes.filter(
      (n) => n.selected && n.type !== "CommentNode",
    );
    if (selectedNodes.length < 2) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const node of selectedNodes) {
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + (node.width ?? 0));
      maxY = Math.max(maxY, node.position.y + (node.height ?? 0));
    }

    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }, [nodes]);

  const isMultiSelect = multiSelectionBounds !== null;

  // Get selected text nodes and their elements for the shared toolbar
  const selectedTextNodes = useMemo(() => {
    return nodes.filter((n) => n.selected && n.type === "TextNode");
  }, [nodes]);

  const selectedTextElements = useMemo(() => {
    return selectedTextNodes
      .map((n) => (n.data as { element: Element }).element)
      .filter(Boolean);
  }, [selectedTextNodes]);

  // Check if any non-text nodes are selected (images)
  // If so, don't show the multi-text toolbar
  const hasNonTextNodeSelected = useMemo(() => {
    return nodes.some(
      (n) => n.selected && n.type !== "CommentNode" && n.type !== "TextNode",
    );
  }, [nodes]);

  // Calculate bounding box for selected text nodes (for toolbar positioning)
  const selectedTextBounds = useMemo(() => {
    if (selectedTextNodes.length < 2) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const node of selectedTextNodes) {
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + (node.width ?? 0));
      maxY = Math.max(maxY, node.position.y + (node.height ?? 0));
    }

    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }, [selectedTextNodes]);

  // Handler for multi-text toolbar variant change
  const handleMultiTextVariantChange = useCallback(
    (newVariant: NonNullable<TextContent["variant"]>) => {
      if (selectedTextElements.length === 0) return;

      commitBeforeChange();
      const updatedElements = selectedTextElements.map((el) => ({
        ...el,
        content:
          el.content?.type === "text"
            ? { ...el.content, variant: newVariant }
            : el.content,
      }));
      updateElements(updatedElements);
    },
    [selectedTextElements, commitBeforeChange, updateElements],
  );

  // Handler for multi-text toolbar bold change
  const handleMultiTextBoldChange = useCallback(
    (newBold: boolean) => {
      if (selectedTextElements.length === 0) return;

      commitBeforeChange();
      const updatedElements = selectedTextElements.map((el) => ({
        ...el,
        content:
          el.content?.type === "text"
            ? { ...el.content, bold: newBold }
            : el.content,
      }));
      updateElements(updatedElements);
    },
    [selectedTextElements, commitBeforeChange, updateElements],
  );

  /* Show/hide multi-select share button with animation (disabled - button removed from UI)
  useEffect(() => {
    if (isMultiSelect) {
      setShowMultiShareButton(true);
      requestAnimationFrame(() => setIsMultiShareButtonVisible(true));
    } else {
      setIsMultiShareButtonVisible(false);
      const timer = setTimeout(() => setShowMultiShareButton(false), 250);
      return () => clearTimeout(timer);
    }
  }, [isMultiSelect]); */

  // Auto-paste when navigating to a new page with paste=true
  // Wait for ReactFlow and viewport to be ready before pasting
  useEffect(() => {
    if (
      !isPastePendingRef.current ||
      !isReactFlowReady ||
      !isInitialViewportSet
    )
      return;
    if (hasPastedRef.current) return;

    // Mark as handled immediately to prevent double-paste
    hasPastedRef.current = true;
    isPastePendingRef.current = false;

    // Clear the URL param
    const url = new URL(window.location.href);
    url.searchParams.delete("paste");
    window.history.replaceState({}, "", url.toString());

    // Get the elements from clipboard and add them directly
    const copiedElements = getClipboard();
    if (copiedElements.length === 0) return;

    // Generate new IDs for the pasted elements
    const newElements: Element[] = copiedElements.map((el) => ({
      ...el,
      slot: {
        ...el.slot,
        id: `pasted-${uuidv4()}`,
        source: "user" as const,
      },
    }));

    // Add the elements
    updateElements(newElements);
    setClipboard(newElements);

    // Select all pasted elements
    const pastedIds = new Set(newElements.map((el) => el.slot.id));
    requestAnimationFrame(() => {
      setNodes((currentNodes) =>
        currentNodes.map((node) => ({
          ...node,
          selected: pastedIds.has(node.id),
        })),
      );
    });
  }, [isReactFlowReady, isInitialViewportSet, updateElements, setNodes]);

  return (
    <div
      ref={canvasWrapperRef}
      className={`canvas-wrapper canvas-mode-${mode}${isMultiSelect ? " multi-select" : ""}${isDraggingFile ? " canvas-dragging-file" : ""}${!isInitialViewportSet ? " canvas-initializing" : ""}${isSpacebarHeld ? " canvas-spacebar-pan" : ""}`}
      style={{ "--canvas-zoom": zoom } as React.CSSProperties}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleFileDrop}
    >
      <ReactFlow
        deleteKeyCode={reactFlowProps.deleteKeyCode}
        elevateNodesOnSelect={false}
        elementsSelectable={reactFlowProps.elementsSelectable}
        maxZoom={4}
        minZoom={0.0001}
        multiSelectionKeyCode="Shift"
        nodes={nodes}
        nodesDraggable={reactFlowProps.nodesDraggable}
        nodeTypes={NODE_TYPES}
        nodeDragThreshold={NODE_DRAG_THRESHOLD_PX}
        onClick={handleClick}
        onInit={handleInit}
        onNodeClick={handleNodeClick}
        onNodeDrag={handleNodeDrag}
        onNodeDragStart={handleNodeDragStart}
        onNodeDragStop={handleNodeDragStop}
        onNodesChange={handleNodesChange}
        onNodesDelete={handleNodesDelete}
        onSelectionChange={handleSelectionChange}
        onSelectionDrag={handleSelectionDrag}
        onSelectionDragStart={handleSelectionDragStart}
        onSelectionDragStop={handleSelectionDragStop}
        panOnDrag={reactFlowProps.panOnDrag}
        panOnScroll={true}
        panOnScrollSpeed={1.15}
        preventScrolling={true}
        proOptions={{ hideAttribution: true }}
        selectionMode={SelectionMode.Partial}
        selectionOnDrag={reactFlowProps.selectionOnDrag}
        snapToGrid={false}
        zoomOnDoubleClick={false}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={GRID_SIZE}
          size={4}
          color="#C2BBB3"
        />
        <GroupBoundingBox />
        {(helperLineH !== null ||
          helperLineV !== null ||
          selectionBox ||
          multiSelectionBounds) && (
          <svg className="canvas-helper-lines">
            <g
              transform={`translate(${transform[0]},${transform[1]}) scale(${transform[2]})`}
            >
              {helperLineV !== null &&
                (() => {
                  const outlineWidth = 2.5 / zoom;
                  // CSS outline is drawn entirely OUTSIDE the element.
                  // SVG stroke is CENTERED on the line position.
                  // Shift by half the width so alignment line outer edge matches
                  // selection outline outer edge.
                  const shift =
                    helperLineV.edge === "left"
                      ? -outlineWidth / 2
                      : helperLineV.edge === "right"
                        ? outlineWidth / 2
                        : 0;
                  const x = helperLineV.position + shift;
                  return (
                    <line
                      className="canvas-helper-line"
                      x1={x}
                      y1={helperLineV.yMin}
                      x2={x}
                      y2={helperLineV.yMax}
                      strokeWidth={outlineWidth}
                    />
                  );
                })()}
              {helperLineH !== null &&
                (() => {
                  const outlineWidth = 2.5 / zoom;
                  // CSS outline is drawn entirely OUTSIDE the element.
                  // SVG stroke is CENTERED on the line position.
                  // Shift by half the width so alignment line outer edge matches
                  // selection outline outer edge.
                  const shift =
                    helperLineH.edge === "top"
                      ? -outlineWidth / 2
                      : helperLineH.edge === "bottom"
                        ? outlineWidth / 2
                        : 0;
                  const y = helperLineH.position + shift;
                  return (
                    <line
                      className="canvas-helper-line"
                      x1={helperLineH.xMin}
                      y1={y}
                      x2={helperLineH.xMax}
                      y2={y}
                      strokeWidth={outlineWidth}
                    />
                  );
                })()}
              {selectionBox && (
                <rect
                  x={Math.min(selectionBox.startX, selectionBox.currentX)}
                  y={Math.min(selectionBox.startY, selectionBox.currentY)}
                  width={Math.abs(selectionBox.currentX - selectionBox.startX)}
                  height={Math.abs(selectionBox.currentY - selectionBox.startY)}
                  fill="rgba(78, 105, 226, 0.1)"
                  stroke="rgba(78, 105, 226, 0.8)"
                  strokeWidth={1 / zoom}
                />
              )}
              {multiSelectionBounds && (
                <rect
                  x={multiSelectionBounds.x}
                  y={multiSelectionBounds.y}
                  width={multiSelectionBounds.width}
                  height={multiSelectionBounds.height}
                  fill="none"
                  stroke="#4E69E2"
                  strokeWidth={2.5 / zoom}
                />
              )}
            </g>
          </svg>
        )}
      </ReactFlow>
      <EmptyCanvasOverlay visible={showEmptyOverlay} />
      {selectedTextBounds &&
        selectedTextElements.length >= 2 &&
        !hasNonTextNodeSelected &&
        !isDraggingNodes && (
          <MultiTextNodeToolbar
            elements={selectedTextElements}
            position={{
              x:
                transform[0] +
                selectedTextBounds.x * zoom +
                (selectedTextBounds.width * zoom) / 2,
              y: transform[1] + selectedTextBounds.y * zoom,
            }}
            onVariantChange={handleMultiTextVariantChange}
            onBoldChange={handleMultiTextBoldChange}
          />
        )}
    </div>
  );
}

const NODE_TYPES = { CommentNode, ImageNode, TextNode };

function getNodeFromElement(element: Element): Node {
  const isTextNode = element.slot.content_type === "text";
  return {
    data: { element },
    height: element.slot.height,
    id: String(element.slot.id),
    position: { x: element.slot.x, y: element.slot.y },
    // text nodes handle their own selection via click handler on the text hit-area
    // this prevents box selection from selecting text nodes by their slot bounds
    selectable: !isTextNode,
    type: getNodeTypeFromElement(element),
    width: element.slot.width,
  };
}

function getNodeTypeFromElement(element: Element): keyof typeof NODE_TYPES {
  switch (element.slot.content_type) {
    case "image":
      return "ImageNode";
    case "text":
      return "TextNode";
    default:
      return "ImageNode";
  }
}

function getNodeFromComment(
  comment: Comment,
  draggable: boolean,
  isSelected: boolean,
): Node {
  return {
    id: comment.id,
    position: { x: comment.x, y: comment.y },
    data: { comment },
    type: "CommentNode",
    zIndex: isSelected ? 9999 : 1000,
    draggable,
  };
}

function CanvasWithReactFlow() {
  return (
    <ReactFlowProvider>
      <CanvasContextProvider>
        <Canvas />
      </CanvasContextProvider>
    </ReactFlowProvider>
  );
}

export default CanvasWithReactFlow;
