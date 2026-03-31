import {
  FC,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useStore } from "reactflow";
import type { NodeProps } from "reactflow";

import { DotLottieReact } from "@lottiefiles/dotlottie-react";

import { AlertCircleIcon, RefreshCwIcon, SparklesIcon } from "../../../icons";
import type { ElementOutput as Element } from "../../../api/types.gen";
import { MOCK_DELAY_MS } from "../../../constants/mockDelays";
import { useAgent } from "../../../hooks/useAgent";
import { useCanvasMode } from "../../../hooks/useCanvasMode";
import { useDesigns } from "../../../hooks/useDesigns";
import { useLayout } from "../../../hooks/useLayout";
import { usePaywall } from "../../../hooks/usePaywall";
import {
  isPlanningFailure,
  useSlotErrorStatus,
} from "../../../hooks/useSlotErrorStatus";
import { sanitizeElements } from "../../../utils/sanitizeElements";
import PaywallModal from "../../paywall-modal/PaywallModal";
import { useCanvasContext } from "../CanvasContext";

import "./ImageNode.css";

// global state for tracking scroll across all ImageNode instances
let globalLastScrollTime = 0;
let wheelListenerRefCount = 0;

const handleWheel = (e: WheelEvent) => {
  // only track panning scrolls, not zoom (ctrl/meta key)
  if (!e.ctrlKey && !e.metaKey) {
    globalLastScrollTime = Date.now();
  }
};

function registerWheelListener() {
  if (typeof window === "undefined") return;
  if (wheelListenerRefCount === 0) {
    window.addEventListener("wheel", handleWheel, {
      capture: true,
      passive: true,
    });
  }
  wheelListenerRefCount++;
}

function unregisterWheelListener() {
  if (typeof window === "undefined") return;
  wheelListenerRefCount--;
  if (wheelListenerRefCount === 0) {
    window.removeEventListener("wheel", handleWheel, { capture: true });
  }
}

const LOADING_MESSAGES = [
  "Applying taste, please hold…",
  "Polishing the pixels…",
  "Giving this a glow up…",
  "Dialing in the details…",
  "Don't worry, this isn't final…",
];

type Data = {
  element: Element;
};

const ImageNode: FC<NodeProps<Data>> = ({ data, dragging }) => {
  const loadingMessage = useMemo(() => {
    return LOADING_MESSAGES[
      Math.floor(Math.random() * LOADING_MESSAGES.length)
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.element.slot.id]);

  const [loadedFinalUrl, setLoadedFinalUrl] = useState<string | null>(null);
  const [isDelayed, setIsDelayed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  // Share button state - disabled (feature commented out)
  const [_linkCopied, setLinkCopied] = useState(false);
  const [showShareButton, setShowShareButton] = useState(false);
  const [_isShareButtonVisible, setIsShareButtonVisible] = useState(false);
  const [_isShareButtonHovered, setIsShareButtonHovered] = useState(false);
  const [_shareButtonPosition, setShareButtonPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const shareButtonElRef = useRef<HTMLButtonElement>(null);
  const prevNodePositionRef = useRef<{
    x: number | undefined;
    y: number | undefined;
  }>({
    x: undefined,
    y: undefined,
  });
  const mousePositionRef = useRef<{ x: number; y: number } | null>(null);

  const {
    agent,
    isResponding,
    sendRequest,
    getCommentsForRequest,
    cancelRequest,
  } = useAgent();

  // force re-render every 45s when requests are active to ensure timeout detection
  // even if backend dies and no SSE events arrive
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    if (!isResponding) return;
    const interval = setInterval(() => forceUpdate((n) => n + 1), 45_000);
    return () => clearInterval(interval);
  }, [isResponding]);

  // register/unregister global wheel listener for trackpad panning detection
  useEffect(() => {
    registerWheelListener();
    return () => unregisterWheelListener();
  }, []);

  const { isSelectionBoxDragging } = useCanvasMode();
  const { layout } = useLayout();
  const { currentDesign } = useDesigns();

  const pageUrl = typeof window !== "undefined" ? window.location.href : "/";
  const {
    showPaywall,
    paywallData,
    checkPaywall,
    handleUpgrade,
    closePaywall,
  } = usePaywall({
    successUrl: pageUrl,
    cancelUrl: pageUrl,
  });
  // Subscribe to isPanDragging for hiding share button during pan-drag
  // Subscribe to selectedCommentId so we re-render when comments open/close
  // (needed for overlap detection to catch newly opened comment popovers)
  const { isPanDragging, selectedCommentId } = useCanvasContext();

  const zoom = useStore((s) => s.transform[2]);
  // subscribe to full viewport transform to update share button position on pan/zoom
  const viewportX = useStore((s) => s.transform[0]);
  const viewportY = useStore((s) => s.transform[1]);
  // track node position to detect external moves (undo, etc.)
  const nodeX = useStore(
    (s) => s.nodeInternals.get(data.element.slot.id)?.position.x,
  );
  const nodeY = useStore(
    (s) => s.nodeInternals.get(data.element.slot.id)?.position.y,
  );
  // Check if multiple non-comment nodes are selected (for hiding individual share button)
  const isMultiSelect = useStore((s) => {
    const nodes = Array.from(s.nodeInternals.values());
    const selectedNodes = nodes.filter(
      (n) => n.selected && n.type !== "CommentNode",
    );
    return selectedNodes.length >= 2;
  });
  // Check if there's at least one OTHER selected node (for detecting multi-select during drag)
  const hasOtherSelectedNode = useStore((s) => {
    const nodes = Array.from(s.nodeInternals.values());
    return nodes.some(
      (n) =>
        n.selected && n.type !== "CommentNode" && n.id !== data.element.slot.id,
    );
  });

  const performShare = useCallback(() => {
    const url = new URL(window.location.href);
    url.hash = `element=${data.element.slot.id}`;
    navigator.clipboard.writeText(url.toString());
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }, [data.element.slot.id]);

  // Share button click handler - disabled (feature commented out)
  const _handleShareClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      performShare();
    },
    [performShare],
  );

  // Find all failed slots from the same request to retry them all together
  // Also track if this is a planning failure (need to replay the whole request)
  const retryInfo = useMemo(() => {
    // Synthetic error slots (from HTTP errors or early failures) should trigger full regeneration
    if (data.element.slot.id.startsWith("error-")) {
      return {
        failedSlots: [data.element.slot],
        isPlanningFailure: true,
      };
    }

    // Find the response that contains this slot
    const response = [...agent.history]
      .reverse()
      .find(
        (item) =>
          (item.type === "generate_revision_agent_response" ||
            item.type === "retry_content_agent_response") &&
          data.element.slot.id in (item.slots ?? {}),
      );

    if (!response) {
      return {
        failedSlots: [data.element.slot],
        isPlanningFailure: false,
      };
    }

    // Check if this is a planning failure
    const planningFailed =
      response.type === "generate_revision_agent_response" ||
      response.type === "retry_content_agent_response"
        ? isPlanningFailure(response)
        : false;

    // Get all slots from this response
    const allSlots = Object.values(
      (response as { slots?: Record<string, typeof data.element.slot> })
        .slots ?? {},
    );

    // Filter to only image slots that don't have content (failed) - for content retry
    const failedImageSlots = allSlots.filter((slot) => {
      if (slot.content_type !== "image") return false;
      // Check if this slot has content in elements
      const element = layout.elements.find((el) => el.slot.id === slot.id);
      const hasContent =
        element?.content?.type === "image" && !element.content.is_preview;
      return !hasContent;
    });

    return {
      failedSlots:
        failedImageSlots.length > 0 ? failedImageSlots : [data.element.slot],
      isPlanningFailure: planningFailed,
    };
  }, [agent.history, data, layout.elements]);

  const handleRetryClick = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!currentDesign?.problem) return;

      // check if user needs to see the paywall
      const shouldShowPaywall = await checkPaywall();
      if (shouldShowPaywall) {
        return;
      }

      // Find request_id for this slot to cancel the stuck request before retrying
      let requestId: string | undefined;
      if (data.element.slot.id.startsWith("error-")) {
        const errorResponse = [...agent.history]
          .reverse()
          .find(
            (item) =>
              item.type === "error_agent_response" &&
              `error-${item.request_id}` === data.element.slot.id,
          );
        requestId =
          errorResponse?.type === "error_agent_response"
            ? (errorResponse.request_id ?? undefined)
            : undefined;
      } else {
        const response = [...agent.history]
          .reverse()
          .find(
            (item) =>
              (item.type === "generate_revision_agent_response" ||
                item.type === "retry_content_agent_response") &&
              data.element.slot.id in (item.slots ?? {}),
          ) as
          | ((typeof agent.history)[number] & { request_id?: string | null })
          | undefined;
        requestId = response?.request_id ?? undefined;
      }

      // Cancel the stuck request before retrying (safe to call even if not active)
      if (requestId) {
        cancelRequest(requestId);
      }

      if (retryInfo.isPlanningFailure) {
        // Planning failed - send a synthetic "retry" comment to trigger revision flow
        // This ensures new slots get new IDs (no conflicts with failed placeholders)
        const retryComment = {
          created_at: new Date().toISOString(),
          id: crypto.randomUUID(),
          message: {
            type: "text" as const,
            text: "Retry this revision for the user",
          },
          images: [],
          is_deleted: true, // Hidden from UI
          is_editable: false,
          is_submitted: true,
          x: data.element.slot.x,
          y: data.element.slot.y,
        };

        // Get comments from the original request (with their original states)
        const requestComments = requestId
          ? getCommentsForRequest(requestId)
          : null;

        // Get IDs of comments that still exist in the layout (not deleted)
        const existingCommentIds = new Set(
          layout.comments.filter((c) => !c.is_deleted).map((c) => c.id),
        );

        // Use original request comments (with correct states), filtered to those still in layout
        const originalComments = (requestComments?.all ?? []).filter((c) =>
          existingCommentIds.has(c.id),
        );

        // Trigger zoom to new content (same as "Design next rev" button)
        window.dispatchEvent(new CustomEvent("focus-new-design"));

        // Send original comments (with their original states) + retry comment
        // Comments are already marked as is_submitted: true from the original request
        sendRequest({
          type: "generate_revision_agent_request",
          elements: sanitizeElements([...layout.elements]),
          comments: [...originalComments, retryComment],
          problem: currentDesign.problem,
        });
      } else {
        // Content generation failed - retry just the failed slots
        sendRequest({
          type: "retry_content_agent_request",
          slots: retryInfo.failedSlots,
          elements: sanitizeElements([...layout.elements]),
          comments: [...layout.comments],
          problem: currentDesign.problem,
        });
      }
    },
    [
      agent,
      cancelRequest,
      checkPaywall,
      currentDesign,
      data.element.slot.id,
      data.element.slot.x,
      data.element.slot.y,
      getCommentsForRequest,
      retryInfo,
      layout.elements,
      layout.comments,
      sendRequest,
    ],
  );

  const imageGenStartTimeRef = useRef<number | null>(null);

  // Check if elements_reasoning has any entries (image generation has started)
  const hasElementsReasoning = useMemo(() => {
    const lastResponse = [...agent.history]
      .reverse()
      .find((e) => e.type === "generate_revision_agent_response");

    if (
      !lastResponse ||
      lastResponse.type !== "generate_revision_agent_response"
    ) {
      return false;
    }

    return Object.keys(lastResponse.elements_reasoning ?? {}).length > 0;
  }, [agent.history]);

  // Track when image generation starts (client-side timestamp)
  useEffect(() => {
    if (
      isResponding &&
      hasElementsReasoning &&
      imageGenStartTimeRef.current === null
    ) {
      // First time seeing elements_reasoning during this request - image gen started
      imageGenStartTimeRef.current = Date.now();
    }
  }, [isResponding, hasElementsReasoning]);

  // Reset when a new request starts
  useEffect(() => {
    if (isResponding) {
      // New request started, reset the timer
      imageGenStartTimeRef.current = null;
      setIsDelayed(false);
    }
  }, [isResponding]);

  // Start the delay timer once image generation has started
  useEffect(() => {
    if (!isResponding || imageGenStartTimeRef.current === null) {
      return;
    }

    const elapsed = Date.now() - imageGenStartTimeRef.current;
    const remaining = MOCK_DELAY_MS - elapsed;

    if (remaining <= 0) {
      setIsDelayed(true);
      return;
    }

    const timeout = window.setTimeout(() => setIsDelayed(true), remaining);
    return () => window.clearTimeout(timeout);
  }, [isResponding, hasElementsReasoning]);

  const content = data.element.content;
  const isUserInput = data.element.slot.source === "user";
  const currentUrl = content?.type === "image" ? content.url : null;

  // Check for generation errors (only for AI-generated slots)
  // Pass Date.now() inline - timeout is checked each time the component renders
  const slotError = useSlotErrorStatus(
    data.element.slot.id,
    agent,
    Date.now(),
    isUserInput,
  );

  // Loading until we have a data URL (for fast screenshot capture)
  const isLoading = !isUserInput && !loadedFinalUrl;

  // Check if the share button position would overlap with UI elements
  // Calculates position directly from wrapperRef to avoid timing issues with state
  const checkShareButtonOverlap = useCallback(() => {
    if (!wrapperRef.current) return false;

    // Calculate share button position from wrapper bounds (same logic as position effect)
    const wrapperRect = wrapperRef.current.getBoundingClientRect();
    const buttonX = wrapperRect.left + wrapperRect.width / 2;
    const buttonY = wrapperRect.top - 38;

    // Share button approximate dimensions (from CSS) with padding for safety
    const buttonWidth = 80; // Actual ~60px + padding
    const buttonHeight = 36; // Actual ~26px + padding
    const buttonLeft = buttonX - buttonWidth / 2;
    const buttonRight = buttonX + buttonWidth / 2;
    const buttonTop = buttonY - 5; // Extra padding above
    const buttonBottom = buttonY + buttonHeight;

    // Check overlap with each UI element
    // Note: Use specific visible elements, not layout containers
    const uiSelectors = [
      ".design-page-floating-bar", // Toolbar (bottom center)
      ".comments-sidebar-share-floating", // Share button (top right)
      ".comments-sidebar-controls-floating", // Zoom controls (bottom right)
      ".design-page-header", // Home + Page selector (top left)
      ".comment-node", // Open comment cards (editable)
      ".comment-node-readonly", // Open comment cards (readonly)
      ".comment-node-icon-fixed", // Comment bubble icons
    ];

    for (const selector of uiSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        const rect = el.getBoundingClientRect();
        // Check for overlap
        if (
          buttonLeft < rect.right &&
          buttonRight > rect.left &&
          buttonTop < rect.bottom &&
          buttonBottom > rect.top
        ) {
          return true;
        }
      }
    }
    return false;
  }, []);

  // Track overlap status in state so we can update it after DOM changes
  const [isOverlapping, setIsOverlapping] = useState(false);

  // Check overlap after DOM updates (when comments open/close, viewport changes, etc.)
  // We check twice: immediately (for existing comments) and after one frame (for new comments)
  // This handles the case where Jotai atom updates (draftComment) and React context updates
  // (selectedCommentId) are processed in separate batches when creating new comments
  useLayoutEffect(() => {
    // Check immediately - catches existing comment popovers
    setIsOverlapping(checkShareButtonOverlap());

    // Also check after one frame - catches new comment popovers whose DOM
    // might not be ready yet due to Jotai/React batching differences
    const frameId = requestAnimationFrame(() => {
      setIsOverlapping(checkShareButtonOverlap());
    });
    return () => cancelAnimationFrame(frameId);
  }, [
    checkShareButtonOverlap,
    selectedCommentId, // Re-check when comments open/close
    viewportX, // Re-check on pan
    viewportY,
    zoom, // Re-check on zoom
    nodeX, // Re-check when node moves
    nodeY,
    isHovered, // Re-check when hover state changes
  ]);

  // Don't show individual share button when multiple elements are selected
  // (the canvas shows "Share in new page" button instead)
  // During selection box drag, also hide if there's another selected node to prevent
  // the share button from briefly flashing before isMultiSelect state propagates
  // Also hide if there's an error state or when dragging the node
  // Hide during both ReactFlow drag (dragging) and pan-while-drag (isPanDragging)
  // Also hide if button would overlap with UI elements
  const shouldShowShareButton =
    content?.type === "image" &&
    !isLoading &&
    !slotError &&
    isHovered &&
    !dragging &&
    !isPanDragging &&
    !isMultiSelect &&
    !(isSelectionBoxDragging && hasOtherSelectedNode) &&
    !isOverlapping;

  useEffect(() => {
    if (shouldShowShareButton) {
      setShowShareButton(true);
      requestAnimationFrame(() => setIsShareButtonVisible(true));
    } else if (dragging || isPanDragging || isOverlapping) {
      // immediately hide when dragging OR overlapping UI - no fade out
      setIsShareButtonVisible(false);
      setShowShareButton(false);
      setShareButtonPosition(null);
    } else {
      // normal fade-out for other cases (mouse leave, etc)
      setIsShareButtonVisible(false);
      const timer = setTimeout(() => {
        setShowShareButton(false);
        setShareButtonPosition(null);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [shouldShowShareButton, dragging, isPanDragging, isOverlapping]);

  // update share button position when visible, viewport changes, or node moves
  useEffect(() => {
    if (!showShareButton || !wrapperRef.current) {
      return;
    }
    const rect = wrapperRef.current.getBoundingClientRect();
    // Position button to float above the slot's top edge
    // Original: padding was 48px above slot, button was at padding top + 10 = slot top - 38
    setShareButtonPosition({
      x: rect.left + rect.width / 2,
      y: rect.top - 38,
    });
  }, [showShareButton, viewportX, viewportY, zoom, nodeX, nodeY]);

  // Share button click detection and cursor override - disabled
  // (share button hover feature has been commented out)
  /*
  // detect clicks on share button manually since it has pointer-events: none
  // this allows wheel/scroll/pinch to pass through to the canvas
  useEffect(() => {
    if (!showShareButton) return;

    // Track if mousedown started over the button to prevent drag-release triggering click
    let mouseDownOverButton = false;

    const isOverButton = (x: number, y: number) => {
      const button = shareButtonElRef.current;
      if (!button) return false;
      const rect = button.getBoundingClientRect();
      return (
        x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
      );
    };

    const handleMouseDown = (e: MouseEvent) => {
      mouseDownOverButton = isOverButton(e.clientX, e.clientY);
      if (mouseDownOverButton) {
        // Stop propagation to prevent Canvas from selecting nodes behind the button
        // (Canvas uses mousedown for selection, so we must intercept here)
        e.stopPropagation();
        e.preventDefault();
      }
    };

    const handleClick = (e: MouseEvent) => {
      // Only trigger if both mousedown AND mouseup were over the button
      // This prevents drag-release from triggering the share action
      if (mouseDownOverButton && isOverButton(e.clientX, e.clientY)) {
        e.stopPropagation();
        performShare();
      }
      mouseDownOverButton = false;
    };

    document.addEventListener("mousedown", handleMouseDown, { capture: true });
    document.addEventListener("click", handleClick, { capture: true });
    return () => {
      document.removeEventListener("mousedown", handleMouseDown, {
        capture: true,
      });
      document.removeEventListener("click", handleClick, { capture: true });
      setIsShareButtonHovered(false);
    };
  }, [showShareButton, performShare]);

  // override cursor to pointer when hovering over share button
  // needed because button has pointer-events: none and canvas modes set custom cursors
  useEffect(() => {
    if (isShareButtonHovered) {
      const previousCursor = document.body.style.cursor;
      document.body.style.cursor = "pointer";
      return () => {
        document.body.style.cursor = previousCursor;
      };
    }
  }, [isShareButtonHovered]);
  */

  // Global mouse tracking for hover detection and share button hover state
  // Since wrapper has pointer-events: none, we can't use mouseEnter/Leave
  // Instead, track mouse position globally and check bounds
  // Throttled with requestAnimationFrame to limit calculations when many images are on canvas
  useEffect(() => {
    let rafId: number | null = null;

    const handleMouseMove = (e: MouseEvent) => {
      // Check share button hover state
      const button = shareButtonElRef.current;
      if (button) {
        const buttonRect = button.getBoundingClientRect();
        const isOverButton =
          e.clientX >= buttonRect.left &&
          e.clientX <= buttonRect.right &&
          e.clientY >= buttonRect.top &&
          e.clientY <= buttonRect.bottom;
        setIsShareButtonHovered(isOverButton);
      }

      if (!wrapperRef.current) return;

      // Get wrapper bounds and extend hover area 48px above the slot (for share button)
      const rect = wrapperRef.current.getBoundingClientRect();
      const hoverExtensionAbove = 48; // screen pixels above slot for hover detection

      const isInBounds =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top - hoverExtensionAbove &&
        e.clientY <= rect.bottom;

      mousePositionRef.current = { x: e.clientX, y: e.clientY };

      if (isInBounds) {
        const recentlyScrolled = Date.now() - globalLastScrollTime < 100;
        if (
          e.buttons === 0 &&
          !dragging &&
          !isPanDragging &&
          !recentlyScrolled
        ) {
          setIsHovered(true);
        }
      } else {
        setIsHovered(false);
        mousePositionRef.current = null;
      }
    };

    // Throttle to once per animation frame to reduce load with many images
    const throttledHandler = (e: MouseEvent) => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        handleMouseMove(e);
        rafId = null;
      });
    };

    document.addEventListener("mousemove", throttledHandler);
    return () => {
      document.removeEventListener("mousemove", throttledHandler);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [dragging, isPanDragging]);

  // detect external position changes (undo, etc.) and reset hover state
  useEffect(() => {
    const prevX = prevNodePositionRef.current.x;
    const prevY = prevNodePositionRef.current.y;
    prevNodePositionRef.current = { x: nodeX, y: nodeY };

    // skip initial render or if position didn't change
    if (prevX === undefined || (prevX === nodeX && prevY === nodeY)) {
      return;
    }

    // skip if we're dragging (already handled)
    if (dragging || isPanDragging) {
      return;
    }

    // position changed externally - wait for DOM update, then check if mouse is over new position
    // only update hover if we have a known mouse position; otherwise leave state unchanged
    requestAnimationFrame(() => {
      if (mousePositionRef.current && wrapperRef.current) {
        const rect = wrapperRef.current.getBoundingClientRect();
        const hoverExtensionAbove = 48; // screen pixels above slot for hover detection
        const { x, y } = mousePositionRef.current;
        const isOverElement =
          x >= rect.left &&
          x <= rect.right &&
          y >= rect.top - hoverExtensionAbove &&
          y <= rect.bottom;
        setIsHovered(isOverElement);
      }
      // If mousePositionRef is null, we don't know where the mouse is,
      // so don't change hover state - leave it as-is
    });
  }, [nodeX, nodeY, dragging, isPanDragging]);

  // convert any image URL to data URL for fast screenshot capture
  useEffect(() => {
    if (!currentUrl) {
      return;
    }

    let cancelled = false;

    // convert URL to data URL so html-to-image doesn't need to fetch
    const loadAsDataUrl = async () => {
      try {
        const res = await fetch(currentUrl, { mode: "cors" });
        const blob = await res.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        });
        if (!cancelled) {
          setLoadedFinalUrl(dataUrl);
        }
      } catch {
        // fallback to original URL if fetch fails
        if (!cancelled) {
          setLoadedFinalUrl(currentUrl);
        }
      }
    };

    loadAsDataUrl();

    return () => {
      cancelled = true;
    };
  }, [currentUrl]);

  // Hook returns "hidden" for non-first slots in planning failure scenarios
  // This check must come AFTER all hooks to satisfy React's rules of hooks
  if (slotError === "hidden") {
    return null;
  }

  if (content?.type === "image") {
    // check if this is a user upload that's still loading (empty URL)
    const isUserUploadLoading = isUserInput && !currentUrl;
    // check if this is a failed upload
    const isUploadError = isUserInput && currentUrl?.startsWith("error:");
    // check if this is a preview image
    const isPreview = content.is_preview === true;

    // Does this slot have a loaded final image to display?
    const hasFinalImageReady =
      // User images: ready if URL exists, not an error, and not a preview (e.g., pasted preview)
      (isUserInput &&
        currentUrl &&
        !currentUrl.startsWith("error:") &&
        !isPreview) ||
      // AI images: ready if we have a data URL and not a preview
      (!isUserInput && loadedFinalUrl && !isPreview);

    // Show overlay if: user upload loading, upload error, generation error, still loading, or user-sourced preview
    const showOverlay =
      isUserUploadLoading ||
      isUploadError ||
      slotError !== null ||
      (!isUserInput && (isPreview || !loadedFinalUrl)) ||
      (isUserInput && isPreview);

    // For previews: show the preview URL directly
    // For finals: show the loaded data URL (fall back to remote URL while loading)
    const displayUrl =
      isUserUploadLoading || isUploadError
        ? undefined
        : isPreview
          ? (currentUrl ?? undefined)
          : (loadedFinalUrl ?? currentUrl ?? undefined);

    return (
      <div ref={wrapperRef} className="image-node-hover-wrapper">
        {/* Share button on hover - disabled
        {showShareButton &&
          shareButtonPosition &&
          createPortal(
            <div
              className={`image-node-share-button-wrapper${isShareButtonVisible ? " visible" : ""}`}
              style={{
                position: "fixed",
                left: shareButtonPosition.x,
                top: shareButtonPosition.y,
                transform: `translateX(-50%) translateY(${isShareButtonVisible ? 0 : 4}px)`,
                transformOrigin: "top center",
              }}
            >
              <button
                ref={shareButtonElRef}
                className={`image-node-share-button${isShareButtonHovered ? " image-node-share-button-hovered" : ""}${linkCopied ? " image-node-share-button-copied" : ""}`}
                onClick={handleShareClick}
                type="button"
              >
                {linkCopied ? (
                  <>
                    <Check size={12} strokeWidth={3} color="#627532" />
                    Copied link
                  </>
                ) : (
                  "Share"
                )}
              </button>
            </div>,
            document.body,
          )}
        */}
        <div
          className="image-node-container"
          style={{
            width: `${data.element.slot.width}px`,
            height: `${data.element.slot.height}px`,
            position: "relative",
          }}
        >
          <img
            data-slot-id={data.element.slot.id}
            src={displayUrl}
            crossOrigin="anonymous"
            draggable={false}
            className={
              hasFinalImageReady
                ? "image-node-final"
                : isUserInput && isPreview
                  ? "image-node-pasted-preview"
                  : "image-node-preview"
            }
            style={{
              height: `${data.element.slot.height}px`,
              objectFit: "contain",
              width: `${data.element.slot.width}px`,
            }}
          />
          {/* Show overlay only if final image is NOT ready */}
          {showOverlay && !hasFinalImageReady && (
            <div className="image-node-loader">
              {isUserInput && isPreview ? null : isUploadError ? ( // User-sourced preview (e.g., pasted): show blur only, no loader
                <div className="image-node-upload-error">
                  <AlertCircleIcon
                    className="image-node-upload-error-icon"
                    strokeWidth={1.5}
                  />
                  <span className="image-node-upload-error-title">
                    Upload failed
                  </span>
                  <span className="image-node-upload-error-subtitle">
                    Please try again
                  </span>
                </div>
              ) : slotError ? (
                <div className="image-node-generation-error">
                  <AlertCircleIcon
                    className="image-node-generation-error-icon"
                    strokeWidth={1.5}
                  />
                  <span className="image-node-generation-error-title">
                    {slotError === "timeout"
                      ? "Taking too long"
                      : "Generation failed"}
                  </span>
                  <button
                    type="button"
                    className="image-node-retry-button nodrag"
                    onClick={handleRetryClick}
                  >
                    <RefreshCwIcon size={24} strokeWidth={2.5} />
                    Retry
                  </button>
                </div>
              ) : isUserUploadLoading ? (
                <div className="image-node-upload-spinner" />
              ) : isDelayed ? (
                <div className="image-node-delayed">
                  <SparklesIcon
                    className="image-node-delayed-icon"
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                  <span className="image-node-delayed-title">
                    Mock on the way
                  </span>
                  <span className="image-node-delayed-subtitle">
                    This mock needs a moment. We&apos;re working in the
                    background. Keep designing new revs in the meantime.
                  </span>
                </div>
              ) : (
                <>
                  <DotLottieReact
                    src="https://drive.orianna.ai/62f744fa89668d4a190680ac3eaaed84.json"
                    loop
                    autoplay
                    mode="bounce"
                    className="image-node-lottie"
                    renderConfig={{
                      devicePixelRatio: window.devicePixelRatio * 2,
                    }}
                  />
                  <span className="image-node-loading-text">
                    {loadingMessage}
                  </span>
                </>
              )}
            </div>
          )}
        </div>
        <PaywallModal
          isOpen={showPaywall}
          onClose={closePaywall}
          onUpgrade={handleUpgrade}
          paywallData={paywallData}
        />
      </div>
    );
  } else {
    // No image content - show error if generation failed, otherwise skeleton
    if (slotError) {
      return (
        <div
          className="image-node-container"
          style={{
            width: `${data.element.slot.width}px`,
            height: `${data.element.slot.height}px`,
            position: "relative",
          }}
        >
          <div className="image-node-loader">
            <div className="image-node-generation-error">
              <AlertCircleIcon
                className="image-node-generation-error-icon"
                strokeWidth={1.5}
              />
              <span className="image-node-generation-error-title">
                {slotError === "timeout"
                  ? "Taking too long"
                  : "Generation failed"}
              </span>
              <button
                type="button"
                className="image-node-retry-button nodrag"
                onClick={handleRetryClick}
              >
                <RefreshCwIcon size={24} strokeWidth={2.5} />
                Retry
              </button>
            </div>
          </div>
          <PaywallModal
            isOpen={showPaywall}
            onClose={closePaywall}
            onUpgrade={handleUpgrade}
            paywallData={paywallData}
          />
        </div>
      );
    }

    return (
      <div
        className="canvas-skeleton"
        style={{
          width: `${data.element.slot.width}px`,
          height: `${data.element.slot.height}px`,
        }}
      />
    );
  }
};

export default ImageNode;
