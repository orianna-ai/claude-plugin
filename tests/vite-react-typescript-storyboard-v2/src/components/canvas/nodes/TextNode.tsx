import {
  FC,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { NodeResizer, useReactFlow, useStore } from "reactflow";
import type { NodeProps } from "reactflow";

import type { ElementOutput as Element, TextContent } from "../../../api/types.gen";
import { GRID_SIZE } from "../../../api/layout";
import { useAgent } from "../../../hooks/useAgent";
import { useCanvasMode } from "../../../hooks/useCanvasMode";
import { useHistory } from "../../../hooks/useHistory";
import { useLayout } from "../../../hooks/useLayout";
import { useSlotErrorStatus } from "../../../hooks/useSlotErrorStatus";
import { useCanvasContext } from "../CanvasContext";

import TextNodeToolbar from "./TextNodeToolbar";

import "./TextNode.css";

type Data = {
  element: Element;
};

type TextVariant = NonNullable<TextContent["variant"]>;

const VARIANT_CLASSES: Record<TextVariant, string> = {
  small: "text-node-small",
  p: "text-node-p",
  h3: "text-node-h3",
  h2: "text-node-h2",
  h1: "text-node-h1",
};

const INPUT_VARIANT_CLASSES: Record<TextVariant, string> = {
  small: "text-node-input-small",
  p: "text-node-input-p",
  h3: "text-node-input-h3",
  h2: "text-node-input-h2",
  h1: "text-node-input-h1",
};

// minimum width for text elements (2 grid cells)
const MIN_TEXT_WIDTH = GRID_SIZE * 2;

const TextNode: FC<NodeProps<Data>> = ({ data, id, dragging }) => {
  const { commitBeforeChange, undo } = useHistory();
  const { updateElements, deleteElements } = useLayout();
  const { agent, isResponding } = useAgent();
  const { mode } = useCanvasMode();
  const { setNodes } = useReactFlow();
  const { setCurrentlyEditingNodeId, saveNodePosition, isPanDragging } =
    useCanvasContext();

  // track selection state via ReactFlow store
  const isSelected = useStore(
    (s) => s.nodeInternals.get(id)?.selected ?? false,
  );

  // count how many text nodes are selected (for hiding individual toolbar during multi-select)
  const selectedTextNodeCount = useStore((s) => {
    let count = 0;
    for (const node of s.nodeInternals.values()) {
      if (node.selected && node.type === "TextNode") {
        count++;
      }
    }
    return count;
  });

  // Check if any non-text nodes are selected (for hiding toolbar during mixed selection)
  const hasNonTextNodeSelected = useStore((s) => {
    for (const node of s.nodeInternals.values()) {
      if (
        node.selected &&
        node.type !== "TextNode" &&
        node.type !== "CommentNode"
      ) {
        return true;
      }
    }
    return false;
  });

  // track viewport transform for positioning toolbar
  const viewportX = useStore((s) => s.transform[0]);
  const viewportY = useStore((s) => s.transform[1]);
  const zoom = useStore((s) => s.transform[2]);

  // track node position for toolbar positioning
  const nodeX = useStore((s) => s.nodeInternals.get(id)?.position.x ?? 0);
  const nodeY = useStore((s) => s.nodeInternals.get(id)?.position.y ?? 0);
  const nodeWidth = useStore(
    (s) => s.nodeInternals.get(id)?.width ?? data.element.slot.width,
  );

  // force re-render every 45s when requests are active to ensure timeout detection
  // even if backend dies and no SSE events arrive
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    if (!isResponding) return;
    const interval = setInterval(() => forceUpdate((n) => n + 1), 45_000);
    return () => clearInterval(interval);
  }, [isResponding]);

  // Check if this slot is from user input
  const isUserInput = data.element.slot.source === "user";

  // auto-width mode: user-created text that hasn't been manually resized
  // width === 0 is the sentinel value for auto-width
  const isAutoWidth = isUserInput && data.element.slot.width === 0;

  // Check slot error status using the same logic as ImageNode
  // Pass Date.now() inline - timeout is checked each time the component renders
  const slotError = useSlotErrorStatus(
    data.element.slot.id,
    agent,
    Date.now(),
    isUserInput,
  );

  const content = data.element.content;
  const variant: TextVariant =
    content?.type === "text" ? (content.variant ?? "p") : "p";
  const isBold = content?.type === "text" ? (content.bold ?? false) : false;
  const originalText = content?.type === "text" ? content.text : "";

  // Split text into content and trailing newlines for display mode
  // Hit-area only contains textWithoutTrailing (for correct click detection)
  // Trailing newlines are rendered separately (for correct height but no click capture)
  const trailingNewlines = originalText.match(/\n+$/)?.[0] || "";
  const textWithoutTrailing = trailingNewlines
    ? originalText.slice(0, -trailingNewlines.length)
    : originalText;

  // Auto-edit new user-created text nodes (text-* prefix with default "Text" content)
  const isNewElement = id.startsWith("text-") && originalText === "Text";

  const [isEditing, setIsEditing] = useState(() => isNewElement);
  const [text, setText] = useState(originalText);
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  // local state for resize preview (real-time width and x position during drag)
  const [resizeWidth, setResizeWidth] = useState<number | null>(null);
  const [resizeX, setResizeX] = useState<number | null>(null);

  // Track pending resize end values - we clear resizeWidth/resizeX only when data.element.slot is updated
  const pendingResizeEndRef = useRef<{ x: number; width: number } | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const displayRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const editContainerRef = useRef<HTMLDivElement>(null);
  // Track if this element was just created (for undo while editing)
  const isNewElementRef = useRef(isNewElement);
  // Flag to skip save on blur (when undoing)
  const skipSaveRef = useRef(false);
  // Store pending cursor offset for click-to-edit (character position in text)
  const pendingCursorOffsetRef = useRef<number | null>(null);
  // Track if this node was selected at mousedown time (for detecting "second click")
  const wasSelectedAtMousedownRef = useRef(false);
  // Capture display height before entering edit mode for consistent sizing
  const capturedDisplayHeightRef = useRef<number | null>(null);

  // Listen for mousedown selection state from Canvas
  useEffect(() => {
    const handleSelectionEvent = (
      e: CustomEvent<{ selectedIds: string[] }>,
    ) => {
      wasSelectedAtMousedownRef.current = e.detail.selectedIds.includes(id);
    };
    window.addEventListener(
      "text-node-mousedown-selection",
      handleSelectionEvent as EventListener,
    );
    return () => {
      window.removeEventListener(
        "text-node-mousedown-selection",
        handleSelectionEvent as EventListener,
      );
    };
  }, [id]);

  // Sync text when content changes externally
  useEffect(() => {
    if (content?.type === "text") {
      setText(content.text);
    }
  }, [content]);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      // Use double RAF to ensure DOM is fully ready after all layout effects
      // First RAF waits for layout effects to trigger re-renders
      // Second RAF waits for those re-renders to complete
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (inputRef.current) {
            inputRef.current.focus();

            const offset = pendingCursorOffsetRef.current;
            if (offset !== null) {
              // Place cursor at click position
              inputRef.current.setSelectionRange(offset, offset);
              pendingCursorOffsetRef.current = null;
            } else {
              // Default: select all text (double-click or keyboard entry)
              inputRef.current.select();
            }
          }
        });
      });
    }
  }, [isEditing]);

  // Measure hidden div dimensions for accurate auto-sizing when text or variant changes during editing
  // useLayoutEffect runs synchronously before paint, eliminating visual flash
  // isEditing is now in deps so we measure when entering edit mode (for existing elements)
  // Also immediately syncs React Flow node dimensions to prevent outline lag on Enter key
  useLayoutEffect(() => {
    if (!isEditing || !measureRef.current) return;

    const height = measureRef.current.offsetHeight;
    const width = measureRef.current.offsetWidth;

    // Update state for other consumers
    if (height !== measuredHeight) {
      setMeasuredHeight(height);
    }
    if (width !== measuredWidth) {
      setMeasuredWidth(width);
    }

    // Immediately sync React Flow node dimensions using measured values
    // This prevents the outline from lagging when pressing Enter (no waiting for state update cycle)
    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id !== id) return node;

        if (isAutoWidth) {
          // Auto-width: sync both dimensions
          if (node.width === width && node.height === height) return node;
          return {
            ...node,
            width: width,
            height: height,
            style: {
              ...node.style,
              width: `${width}px`,
              height: `${height}px`,
            },
          };
        } else {
          // Fixed-width: sync only height
          if (node.height === height) return node;
          return {
            ...node,
            height: height,
            style: {
              ...node.style,
              height: `${height}px`,
            },
          };
        }
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, variant, isBold, isEditing, id, setNodes, isAutoWidth]);

  // Sync auto-width dimensions in display mode (after edits or size changes)
  useLayoutEffect(() => {
    if (!isAutoWidth || isEditing) return;

    // Skip if local text doesn't match saved text - save is in progress
    // The effect will re-run when content.text (originalText) updates
    if (text !== originalText) return;

    const displayEl = displayRef.current;
    if (!displayEl) return;

    const width = displayEl.offsetWidth;
    const height = displayEl.offsetHeight;

    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id
          ? {
              ...node,
              width,
              height,
              style: {
                ...node.style,
                width: `${width}px`,
                height: `${height}px`,
              },
            }
          : node,
      ),
    );
  }, [
    isAutoWidth,
    isEditing,
    text,
    variant,
    isBold,
    id,
    setNodes,
    originalText,
  ]);

  // Sync position, width, and height during resize - runs after resizeWidth/resizeX cause DOM to update
  // This ensures we measure height AFTER text has wrapped at the new width
  // Also updates position and width to ensure the outline follows the resize in real-time
  useLayoutEffect(() => {
    if (resizeWidth === null || resizeX === null) return;

    const contentHeight = displayRef.current?.offsetHeight;
    if (!contentHeight) return;

    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id
          ? {
              ...node,
              position: { x: resizeX, y: node.position.y },
              width: resizeWidth,
              height: contentHeight,
              style: {
                ...node.style,
                width: `${resizeWidth}px`,
                height: `${contentHeight}px`,
              },
            }
          : node,
      ),
    );
  }, [resizeWidth, resizeX, id, setNodes]);

  // Clear resizeWidth/resizeX when BOTH the slot AND the React Flow node have been updated
  // This prevents the visual jump caused by clearing resize state before everything is synced
  useEffect(() => {
    const pending = pendingResizeEndRef.current;
    if (!pending) return;

    const slotX = data.element.slot.x;
    const slotWidth = data.element.slot.width;
    const slotMatches = slotX === pending.x && slotWidth === pending.width;
    const nodeMatches = nodeX === pending.x && nodeWidth === pending.width;

    // Only clear when BOTH the slot AND the node position are correct
    if (slotMatches && nodeMatches) {
      pendingResizeEndRef.current = null;
      setResizeWidth(null);
      setResizeX(null);
    }
  }, [data.element.slot.x, data.element.slot.width, nodeX, nodeWidth]);

  // Sync React Flow node height when variant changes (font size affects height)
  // Skip for auto-width elements - they're handled by the auto-width sync effect which updates both width and height
  // Note: isEditing is intentionally NOT in deps - we only want to sync when variant/bold changes,
  // not when entering/exiting edit mode (which would interfere with focus)
  useLayoutEffect(() => {
    // Skip for auto-width elements - they're handled by the auto-width sync effect
    if (isAutoWidth) return;

    // Use measureRef in editing mode, displayRef in display mode
    const measureEl = isEditing ? measureRef.current : displayRef.current;
    const contentHeight = measureEl?.offsetHeight;
    if (!contentHeight) return;

    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id
          ? {
              ...node,
              height: contentHeight,
              style: {
                ...node.style,
                height: `${contentHeight}px`,
              },
            }
          : node,
      ),
    );
  }, [variant, isBold, id, setNodes, isAutoWidth, isEditing]);

  // Reset measured dimensions and captured display height when exiting edit mode
  useEffect(() => {
    if (!isEditing) {
      setMeasuredHeight(null);
      setMeasuredWidth(null);
      capturedDisplayHeightRef.current = null;
    }
  }, [isEditing]);

  // Sync React Flow node dimensions in display mode for non-auto-width elements
  // Runs when exiting edit mode, when content.text updates, or when slot.width changes (undo/redo)
  useLayoutEffect(() => {
    if (isEditing) return;
    if (isAutoWidth) return; // Auto-width elements have their own sync effect

    const displayEl = displayRef.current;
    if (!displayEl) return;

    const contentHeight = displayEl.offsetHeight;
    if (!contentHeight) return;

    const slotWidth = data.element.slot.width;

    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id
          ? {
              ...node,
              width: slotWidth,
              height: contentHeight,
              style: {
                ...node.style,
                width: `${slotWidth}px`,
                height: `${contentHeight}px`,
              },
            }
          : node,
      ),
    );
  }, [
    isEditing,
    isAutoWidth,
    id,
    setNodes,
    originalText,
    data.element.slot.width,
  ]);

  // Stop event propagation in bubbling phase to prevent Canvas from interfering during edit
  // Using bubbling (not capture) so the textarea receives the event first for cursor positioning
  useEffect(() => {
    if (!isEditing || !editContainerRef.current) return;

    const container = editContainerRef.current;
    const stopProp = (e: Event) => e.stopPropagation();

    container.addEventListener("mousedown", stopProp);
    container.addEventListener("click", stopProp);

    return () => {
      container.removeEventListener("mousedown", stopProp);
      container.removeEventListener("click", stopProp);
    };
  }, [isEditing]);

  // For new elements, commit AFTER element is created so undo restores to "Text" not deletion
  // This creates an undo checkpoint with the element containing default text
  // Also set currentlyEditingNodeId since new elements start in edit mode
  useEffect(() => {
    if (isNewElementRef.current && isEditing) {
      setCurrentlyEditingNodeId(id);
      // Use setTimeout to ensure element is fully in layout before committing
      const timer = setTimeout(() => {
        commitBeforeChange();
        // Clear the flag so we don't commit again on re-renders
        isNewElementRef.current = false;
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isEditing, commitBeforeChange, setCurrentlyEditingNodeId, id]);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      // Only allow edit mode in "select" or "text" mode
      // In "pan" or "comment" mode, let the event propagate to Canvas
      if (mode !== "select" && mode !== "text") {
        return;
      }

      e.stopPropagation();

      // clear pending cursor offset so edit mode will select all text
      pendingCursorOffsetRef.current = null;

      // clear measured dimensions so they're freshly calculated when entering edit mode
      setMeasuredWidth(null);
      setMeasuredHeight(null);

      // capture display height before entering edit mode
      capturedDisplayHeightRef.current =
        displayRef.current?.offsetHeight ?? null;

      commitBeforeChange();
      setCurrentlyEditingNodeId(id);
      setIsEditing(true);
    },
    [mode, commitBeforeChange, setCurrentlyEditingNodeId, id],
  );

  const handleSave = useCallback(() => {
    // Skip save if we're undoing (element will be removed)
    if (skipSaveRef.current) {
      skipSaveRef.current = false;
      return;
    }
    if (content?.type === "text") {
      const trimmedText = text.trim();
      // Delete element if text is empty
      if (trimmedText === "") {
        deleteElements([id]);
        setCurrentlyEditingNodeId(null);
        return;
      }
      // Just save the text - height will auto-adjust in display mode
      // Save original text (not trimmed) to preserve trailing newlines
      updateElements([
        {
          ...data.element,
          content: { ...content, text: text },
        },
      ]);
    }
    setCurrentlyEditingNodeId(null);
    setIsEditing(false);
  }, [
    content,
    data.element,
    text,
    id,
    updateElements,
    deleteElements,
    setCurrentlyEditingNodeId,
  ]);

  // Handle blur: save (currentlyEditingNodeId is cleared in handleSave)
  const handleBlur = useCallback(() => {
    handleSave();
  }, [handleSave]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Escape is handled globally by Canvas (blur + deselect)
      // Handle Cmd+Z while editing a new element - trigger global undo to remove it
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const modifier = isMac ? e.metaKey : e.ctrlKey;
      if (modifier && e.key === "z" && !e.shiftKey && isNewElementRef.current) {
        e.preventDefault();
        // Set flag to skip save on blur, then undo
        skipSaveRef.current = true;
        undo();
      }
    },
    [undo],
  );

  const handleVariantChange = useCallback(
    (newVariant: TextVariant) => {
      if (content?.type === "text") {
        commitBeforeChange();
        updateElements([
          {
            ...data.element,
            content: {
              ...content,
              variant: newVariant,
              // Use current text state if editing, otherwise keep saved text
              text: isEditing ? text : content.text,
            },
          },
        ]);
      }
    },
    [
      content,
      data.element,
      updateElements,
      commitBeforeChange,
      isEditing,
      text,
    ],
  );

  const handleBoldChange = useCallback(
    (newBold: boolean) => {
      if (content?.type === "text") {
        commitBeforeChange();
        updateElements([
          {
            ...data.element,
            content: {
              ...content,
              bold: newBold,
              // Use current text state if editing, otherwise keep saved text
              text: isEditing ? text : content.text,
            },
          },
        ]);
      }
    },
    [
      content,
      data.element,
      updateElements,
      commitBeforeChange,
      isEditing,
      text,
    ],
  );

  // resize handlers for width adjustment
  const handleResizeStart = useCallback(() => {
    // Check if there's a stale pending ref from a previous resize (would be a bug)
    if (pendingResizeEndRef.current) {
      console.warn(
        "[RESIZE START] WARNING: pendingResizeEndRef still set from previous resize!",
        pendingResizeEndRef.current,
      );
      // Clear it to avoid issues
      pendingResizeEndRef.current = null;
    }
    commitBeforeChange();
  }, [commitBeforeChange]);

  const handleResize = useCallback(
    (
      _event: unknown,
      params: { x: number; y: number; width: number; height: number },
    ) => {
      // Update local state for real-time preview (width and x position)
      setResizeWidth(params.width);
      setResizeX(params.x);
    },
    [],
  );

  const handleResizeEnd = useCallback(
    (
      _event: unknown,
      params: { x: number; y: number; width: number; height: number },
    ) => {
      const snappedWidth = Math.round(params.width / GRID_SIZE) * GRID_SIZE;
      const snappedX = Math.round(params.x / GRID_SIZE) * GRID_SIZE;
      const finalWidth = Math.max(snappedWidth, MIN_TEXT_WIDTH);

      // Measure final content height after resize
      const contentHeight = displayRef.current?.offsetHeight;

      // Update React Flow node position, width, height, AND data.element
      // We must update data.element so that when resizeWidth becomes null,
      // the wrapper uses the correct width from data.element.slot.width
      setNodes((nodes) =>
        nodes.map((node) =>
          node.id === id
            ? {
                ...node,
                data: {
                  ...node.data,
                  element: {
                    ...data.element,
                    slot: {
                      ...data.element.slot,
                      width: finalWidth,
                      x: snappedX,
                    },
                  },
                },
                position: { x: snappedX, y: node.position.y },
                width: finalWidth,
                height: contentHeight ?? node.height,
                style: {
                  ...node.style,
                  width: `${finalWidth}px`,
                  height: contentHeight
                    ? `${contentHeight}px`
                    : node.style?.height,
                },
              }
            : node,
        ),
      );

      // Update layout state
      updateElements(
        [
          {
            ...data.element,
            slot: {
              ...data.element.slot,
              width: finalWidth,
              x: snappedX,
            },
          },
        ],
        { preserveExistingPositions: false },
      );

      // CRITICAL: Save the position to protect it from stale layout updates
      // This uses the same mechanism as drag protection in Canvas
      saveNodePosition(id, snappedX, data.element.slot.y);

      // Don't clear resizeWidth/resizeX directly - the setNodes update hasn't been applied yet!
      // Instead, set a pending ref and let the useEffect clear them when data.element.slot is updated
      pendingResizeEndRef.current = { x: snappedX, width: finalWidth };
    },
    [id, data.element, updateElements, setNodes, saveNodePosition],
  );

  // capture selection state at mousedown for detecting "second click" to enter edit mode
  const handleMouseDown = useCallback(() => {
    wasSelectedAtMousedownRef.current = isSelected;
  }, [isSelected]);

  // handle click on text hit area for selection and edit mode entry
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      // Skip if double-click (let handleDoubleClick handle)
      if (e.detail >= 2) {
        return;
      }

      // Only allow selection/interaction in "select" or "text" mode
      // In "pan" or "comment" mode, let the event propagate to Canvas
      if (mode !== "select" && mode !== "text") {
        return;
      }

      // Now we're handling it - stop propagation
      e.stopPropagation();

      if (!wasSelectedAtMousedownRef.current) {
        // First click on unselected node - select it
        setNodes((nodes) =>
          nodes.map((n) => ({
            ...n,
            selected: n.id === id ? true : e.shiftKey ? n.selected : false,
          })),
        );
      } else {
        // Second click on already-selected node - enter edit mode with cursor
        let offset: number | null = null;
        if (document.caretRangeFromPoint) {
          const range = document.caretRangeFromPoint(e.clientX, e.clientY);
          if (range && displayRef.current?.contains(range.startContainer)) {
            offset = range.startOffset;
          }
        }
        pendingCursorOffsetRef.current = offset;

        // clear measured dimensions so they're freshly calculated when entering edit mode
        setMeasuredWidth(null);
        setMeasuredHeight(null);

        // capture display height before entering edit mode
        capturedDisplayHeightRef.current =
          displayRef.current?.offsetHeight ?? null;

        // clear any resize preview before entering edit mode
        setResizeWidth(null);

        commitBeforeChange();
        setCurrentlyEditingNodeId(id);
        setIsEditing(true);
      }
    },
    [id, mode, setNodes, commitBeforeChange, setCurrentlyEditingNodeId],
  );

  // calculate toolbar position (above the node, centered)
  const toolbarPosition = {
    x: viewportX + nodeX * zoom + (nodeWidth * zoom) / 2,
    y: viewportY + nodeY * zoom,
  };

  // show toolbar when selected, but only if this is the only selected text node
  // (when multiple text nodes are selected, Canvas renders a shared toolbar)
  // Also hide if any non-text nodes are selected (mixed selection)
  // Hide during both ReactFlow drag (dragging) and pan-while-drag (isPanDragging)
  const showToolbar =
    isSelected &&
    selectedTextNodeCount === 1 &&
    !hasNonTextNodeSelected &&
    !dragging &&
    !isPanDragging;

  // Handle missing content: show skeleton while loading, nothing if request done
  if (content?.type !== "text" || (variant === "h1" && !content.text)) {
    // If slotError is null and we have no content, the request is still in progress
    // If slotError is set, the request completed without content - render nothing
    if (slotError === null) {
      // Still loading - show skeleton
      return (
        <div
          data-slot-id={data.element.slot.id}
          className="canvas-skeleton"
          style={{
            width: `${data.element.slot.width}px`,
            height: `${data.element.slot.height}px`,
          }}
        />
      );
    }
    // Request finished but no content - render nothing (don't show shimmer)
    return null;
  }

  // build class names
  const variantClass = VARIANT_CLASSES[variant];
  const inputVariantClass = INPUT_VARIANT_CLASSES[variant];
  const boldClass = isBold ? "text-node-bold" : "";
  const inputBoldClass = isBold ? "text-node-input-bold" : "";

  // Editing mode
  if (isEditing) {
    // For auto-width elements, use measureRef to get actual content height
    // Don't fall back to slot.height (which is 200px) - that's for LLM-placed elements
    const editingHeight = isAutoWidth
      ? (measuredHeight ?? measureRef.current?.offsetHeight ?? 60) // 60px ≈ "p" variant line height
      : (measuredHeight ??
        capturedDisplayHeightRef.current ??
        data.element.slot.height);

    // For auto-width elements: use fit-content with no wrapping (text stays on one line)
    // For fixed-width elements: use the slot width with normal wrapping
    // position: relative ensures measureRef (position: absolute) has proper containing block
    const containerStyle = isAutoWidth
      ? {
          position: "relative" as const,
          width: "fit-content" as const,
          minWidth: `${MIN_TEXT_WIDTH}px`,
          height: `${editingHeight}px`,
          pointerEvents: "auto" as const,
        }
      : {
          position: "relative" as const,
          width: `${data.element.slot.width}px`,
          height: `${editingHeight}px`,
          pointerEvents: "auto" as const,
        };

    const textareaStyle = isAutoWidth
      ? {
          width: measuredWidth ? `${measuredWidth}px` : "fit-content",
          minWidth: `${MIN_TEXT_WIDTH}px`,
          height: `${editingHeight}px`,
          whiteSpace: "pre" as const,
        }
      : {
          width: `${data.element.slot.width}px`,
          height: `${editingHeight}px`,
        };

    return (
      <>
        {showToolbar && (
          <TextNodeToolbar
            variant={variant}
            bold={isBold}
            position={toolbarPosition}
            onVariantChange={handleVariantChange}
            onBoldChange={handleBoldChange}
          />
        )}
        {/* Container captures clicks during edit mode via bubbling-phase listeners */}
        <div
          ref={editContainerRef}
          className={`nodrag nopan ${isAutoWidth ? "text-node-edit-auto-width" : ""}`}
          style={containerStyle}
        >
          {/* Hidden div to measure text height with same styling as display mode */}
          <div
            ref={measureRef}
            className={`text-node-measure ${variantClass} ${boldClass} ${isAutoWidth ? "text-node-measure-auto-width" : ""}`}
            style={{
              position: "absolute",
              visibility: "hidden",
              pointerEvents: "none",
            }}
            aria-hidden="true"
          >
            {text ? text + "\u200B" : " "}
          </div>
          <textarea
            ref={inputRef}
            data-slot-id={data.element.slot.id}
            className={`text-node-input ${inputVariantClass} ${inputBoldClass} nopan nodrag ${isAutoWidth ? "text-node-input-auto-width" : ""}`}
            style={textareaStyle}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            onPointerMove={(e) => {
              // Only capture when dragging (button held) to allow text selection outside textarea
              // Don't capture on pointerdown - that breaks clicking to place cursor
              if (
                e.buttons > 0 &&
                !e.currentTarget.hasPointerCapture(e.pointerId)
              ) {
                e.currentTarget.setPointerCapture(e.pointerId);
              }
            }}
            onPointerUp={(e) => {
              // Release capture when done (safe to call even if not captured)
              if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                e.currentTarget.releasePointerCapture(e.pointerId);
              }
            }}
          />
        </div>
      </>
    );
  }

  // Display mode - render with auto height, effect will sync slot.height
  // wrapper has pointer-events: none so clicks outside text pass through
  // hit area has pointer-events: auto and handles selection/edit

  return (
    <>
      {showToolbar && (
        <TextNodeToolbar
          variant={variant}
          bold={isBold}
          position={toolbarPosition}
          onVariantChange={handleVariantChange}
          onBoldChange={handleBoldChange}
        />
      )}
      {/* Resize handles - show when selected */}
      {isSelected && (
        <NodeResizer
          lineClassName="text-node-resize-line"
          handleClassName="text-node-resize-handle"
          minWidth={MIN_TEXT_WIDTH}
          onResizeStart={handleResizeStart}
          onResize={handleResize}
          onResizeEnd={handleResizeEnd}
        />
      )}
      <div
        className={`text-node-wrapper ${isAutoWidth && resizeWidth === null ? "text-node-auto-width" : ""}`}
        style={
          resizeWidth !== null
            ? { width: `${resizeWidth}px` }
            : isAutoWidth
              ? undefined
              : { width: `${data.element.slot.width}px` }
        }
      >
        <div
          ref={displayRef}
          className={`text-node-display ${variantClass} ${boldClass} ${isAutoWidth && resizeWidth === null ? "text-node-display-auto-width" : ""}`}
        >
          <span
            data-slot-id={data.element.slot.id}
            className="text-node-hit-area"
            onMouseDown={handleMouseDown}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
          >
            {textWithoutTrailing}
          </span>
          {trailingNewlines && (
            <span className="text-node-trailing">
              {trailingNewlines + "\u200B"}
            </span>
          )}
        </div>
      </div>
    </>
  );
};

export default TextNode;
