import {
  FC,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Markdown from "react-markdown";
import { useStore } from "reactflow";
import type { NodeProps } from "reactflow";
import { v4 as uuidv4 } from "uuid";

import {
  AlertCircleIcon,
  ArrowUpIcon,
  CommentBubbleIcon,
  ImageIcon,
  Loader2Icon,
  PaletteIcon,
  SlidersHorizontalIcon,
  Trash2Icon,
  WorkflowIcon,
  XIcon,
} from "../../../icons";
import { useIdentity } from "../../../identity";
import { DRIVE_CLIENT } from "../../../drive";
import type {
  Comment,
  ElementOutput as Element,
  ImageContent,
  TextContent,
} from "../../../api/types.gen";
import { useAgent } from "../../../hooks/useAgent";
import { useDesigns } from "../../../hooks/useDesigns";
import { useLayout } from "../../../hooks/useLayout";
import ImageModal from "../../image-modal/ImageModal";
import { useCanvasContext } from "../CanvasContext";

import "./CommentNode.css";

type Data = {
  comment: Comment;
};

const FEEDBACK_PLACEHOLDER = "Write feedback for more mocks...";
const CHAT_PLACEHOLDER = "Chat with Softlight...";
const FIRST_GEN_PLACEHOLDER =
  "Describe the user problem and upload a screenshot of the experience...";

const PILL_PLACEHOLDERS: Record<string, string> = {
  "Describe issue": "The problem with this is ",
  "Request flows": "Generate flows for when a user ",
  "Add constraints": "Consider these constraints: ",
  "Design system": "Follow the styles in the attached images ",
};

// Placement calculation constants
const POPOVER_WIDTH = 364;
const POPOVER_HEIGHT = 180;
const HEADER_HEIGHT = 70; // Extra padding from top
const FLOATING_BAR_HEIGHT = 120; // Account for progress/loading indicators
const FLOATING_BAR_WIDTH = 500;
const POPOVER_GAP = 26;

// Persist mode preference per thread across component re-mounts (within session)
const threadModePreferences = new Map<string, "feedback" | "chat">();

/**
 * Get first initial from a name.
 * Examples: "John Doe" -> "J", "John" -> "J"
 */
function getInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase();
}

const CommentNode: FC<NodeProps<Data>> = ({ data: { comment } }) => {
  const { layout, updateComments, addComment, getThreads } = useLayout();
  const { sendRequest, agent } = useAgent();
  const { currentDesign } = useDesigns();
  const identity = useIdentity();

  // Get transform and selected comment state from shared context
  // Must be declared early since many hooks below depend on isSelected
  const {
    tx,
    ty,
    zoom,
    selectedCommentId,
    setSelectedCommentId,
    activeGroupNodeId,
    setActiveGroupNodeId,
    setActiveGroupNodeChatMode,
  } = useCanvasContext();

  // Determine if this comment is selected based on local state (not persisted)
  const isSelected = selectedCommentId === comment.id;

  // Track hover state for showing bounding box around grouped mocks
  const [isHovered, setIsHovered] = useState(false);

  // Reset hover state when selection changes (DOM element changes, mouseLeave won't fire)
  useEffect(() => {
    if (isSelected) {
      setIsHovered(false);
    }
  }, [isSelected]);

  // Get all messages in this thread
  const threadMessages = useMemo(() => {
    const threads = getThreads();
    // This comment's thread_id, or its own id if it's the root
    const threadId = comment.thread_id ?? comment.id;
    const messages = threads.get(threadId) ?? [comment];
    // Filter out deleted messages
    return messages.filter((m) => !m.is_deleted);
  }, [comment, getThreads]);

  // Determine if this thread was started by AI (for default mode)
  // Use explicit root check (thread_id is null/undefined for root) instead of relying on array order
  const rootComment = threadMessages.find((m) => !m.thread_id);
  const threadStartedByAI = rootComment?.source === "ai";

  // Update activeGroupNodeId when comment is hovered or selected
  // This triggers the bounding box to show around grouped mocks
  // Note: chat mode is updated in a separate effect below once replyMode/composerMode are defined
  useEffect(() => {
    if (isSelected || isHovered) {
      setActiveGroupNodeId(comment.id);
    } else if (activeGroupNodeId === comment.id) {
      // Only clear if we're the active one (avoid clearing another comment's state)
      setActiveGroupNodeId(null);
      setActiveGroupNodeChatMode(false);
    }
  }, [
    isSelected,
    isHovered,
    comment.id,
    activeGroupNodeId,
    setActiveGroupNodeId,
    setActiveGroupNodeChatMode,
  ]);

  // Check if model is responding to this thread
  const isThreadResponding = useMemo(() => {
    const threadId = comment.thread_id ?? comment.id;
    return agent.history.some(
      (item: { type?: string; comment_id?: string; id?: string }) =>
        item.type === "generate_comment_reply_agent_request" &&
        "comment_id" in item &&
        item.comment_id === threadId &&
        Object.keys(agent.lastEventIdByRequestId ?? {}).includes(item.id ?? ""),
    );
  }, [agent, comment]);

  // Get the latest model message for preview and notification dot
  // Using the latest (not first) ensures we animate when AI responds again in a thread
  const modelMessage = [...threadMessages]
    .reverse()
    .find((m) => m.source === "ai");

  // State for thread reply input
  const [replyText, setReplyText] = useState("");
  const [replyImages, setReplyImages] = useState<ImageContent[]>([]);
  const [replyUploadingCount, setReplyUploadingCount] = useState(0);
  // Get the thread ID for mode persistence
  const threadId = comment.thread_id ?? comment.id;
  // Check for persisted mode preference, otherwise use default based on thread source
  const getInitialReplyMode = useCallback((): "feedback" | "chat" => {
    const persisted = threadModePreferences.get(threadId);
    if (persisted) return persisted;
    return threadStartedByAI ? "chat" : "feedback";
  }, [threadId, threadStartedByAI]);
  const [replyMode, setReplyMode] = useState<"feedback" | "chat">(
    getInitialReplyMode,
  );
  // Track if we've initialized the mode for this thread (to avoid resetting on re-render)
  const replyModeInitializedRef = useRef<string | null>(null);
  const [composerMode, setComposerMode] = useState<"feedback" | "chat">(
    "feedback",
  );
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const replyFileInputRef = useRef<HTMLInputElement>(null);
  const threadMessagesRef = useRef<HTMLDivElement>(null);
  const commentBodyRef = useRef<HTMLDivElement>(null);

  // Track if thread messages area is scrollable (to show border separator)
  const [isThreadScrollable, setIsThreadScrollable] = useState(false);

  // Track if thread was already open for scroll behavior (instant vs smooth)
  const threadWasOpenRef = useRef(false);

  // Detect when thread messages become scrollable
  useEffect(() => {
    const el = threadMessagesRef.current;
    if (!el || !isSelected) return;

    const checkScrollable = () => {
      setIsThreadScrollable(el.scrollHeight > el.clientHeight);
    };

    // Check initially
    checkScrollable();

    // Watch for size changes
    const resizeObserver = new ResizeObserver(checkScrollable);
    resizeObserver.observe(el);

    return () => resizeObserver.disconnect();
  }, [isSelected, threadMessages.length, isThreadResponding]);

  // Auto-scroll thread to show the last message with context from the previous one
  useEffect(() => {
    if (!isSelected || !threadMessagesRef.current) {
      // Reset when thread closes
      if (!isSelected) {
        threadWasOpenRef.current = false;
      }
      return;
    }

    const container = threadMessagesRef.current;

    // Use instant scroll on open, smooth scroll when content loads
    const isFirstOpen = !threadWasOpenRef.current;
    threadWasOpenRef.current = true;

    // Wait for DOM layout to complete before calculating scroll position
    requestAnimationFrame(() => {
      // Find all messages including the loading indicator (thinking state counts as latest)
      const allMessages = container.querySelectorAll(
        ".comment-node-thread-message",
      );

      if (allMessages.length === 0) return;

      const lastMessage = allMessages[allMessages.length - 1] as HTMLElement;

      // Scroll to show the last message near the top, with a bit of the
      // previous message bleeding in from above for context (~2 lines worth)
      const contextAmount = 48; // How much of the previous message to show above
      const scrollTarget = Math.max(0, lastMessage.offsetTop - contextAmount);

      container.scrollTo({
        top: scrollTarget,
        behavior: isFirstOpen ? "instant" : "smooth",
      });
    });
  }, [isSelected, threadMessages.length, isThreadResponding]);

  // Sync reply mode from persisted preferences when comment becomes selected and readonly
  // Use a combined key of threadId + editable state to re-sync when transitioning from composer to thread view
  const modeKey = `${threadId}-${comment.is_editable}`;
  useEffect(() => {
    if (replyModeInitializedRef.current !== modeKey) {
      replyModeInitializedRef.current = modeKey;
      setReplyMode(getInitialReplyMode());
    }
  }, [modeKey, getInitialReplyMode]);

  // Persist mode preference when user changes it
  useEffect(() => {
    threadModePreferences.set(threadId, replyMode);
  }, [threadId, replyMode]);

  // Update activeGroupNodeChatMode when this comment is active and mode changes
  // Use composerMode for new comments (is_editable), replyMode for submitted comments
  useEffect(() => {
    if (activeGroupNodeId === comment.id) {
      const currentMode = comment.is_editable ? composerMode : replyMode;
      setActiveGroupNodeChatMode(currentMode === "chat");
    }
  }, [
    activeGroupNodeId,
    comment.id,
    comment.is_editable,
    composerMode,
    replyMode,
    setActiveGroupNodeChatMode,
  ]);

  // Handle wheel events for scrollable comment content:
  // - Zoom gestures (Ctrl/Cmd + scroll): prevent browser zoom, let React Flow handle canvas zoom
  // - Regular scroll: capture if content is scrollable to prevent canvas panning
  //   If content is NOT scrollable, let events through so canvas panning works
  // Note: Browser back/forward swipe is handled globally in Canvas.tsx
  useEffect(() => {
    const threadEl = threadMessagesRef.current;
    const bodyEl = commentBodyRef.current;

    const handleWheelEvent = (e: WheelEvent) => {
      const isZoomGesture = e.ctrlKey || e.metaKey;

      if (isZoomGesture) {
        // Zoom gesture: prevent browser zoom but let it bubble to React Flow
        // so the canvas zoom handler can process it
        e.preventDefault();
        return;
      }

      // Check if this element is actually scrollable
      const target = e.currentTarget as HTMLElement;
      const isScrollable = target.scrollHeight > target.clientHeight;

      if (!isScrollable) {
        // Not scrollable - let canvas pan
        return;
      }

      // Content is scrollable - capture all wheel events to prevent
      // disorienting canvas panning when user hits scroll boundaries.
      // User must move cursor outside the comment to pan the canvas.
      e.stopPropagation();
    };

    // Use passive: false to allow preventDefault for zoom gestures
    const options = { passive: false };

    if (threadEl) {
      threadEl.addEventListener("wheel", handleWheelEvent, options);
    }
    if (bodyEl) {
      bodyEl.addEventListener("wheel", handleWheelEvent, options);
    }

    return () => {
      if (threadEl) {
        threadEl.removeEventListener("wheel", handleWheelEvent);
      }
      if (bodyEl) {
        bodyEl.removeEventListener("wheel", handleWheelEvent);
      }
    };
  }, [isSelected]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isShaking, setIsShaking] = useState(false);
  const [text, setText] = useState(comment.message.text);
  const [isOpening, setIsOpening] = useState(false);
  const previouslySelectedRef = useRef(false);
  const [images, setImages] = useState(comment.images);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [modalImageUrl, setModalImageUrl] = useState<string | null>(null);
  const [placeholderKey, setPlaceholderKey] = useState(0);
  const [showPills, setShowPills] = useState(true);
  const placeholderResetTimeoutRef = useRef<number | null>(null);
  const [closeAttempts, setCloseAttempts] = useState(0);

  // Track if a text selection drag is in progress to prevent accidental close
  const isTextSelectionDraggingRef = useRef(false);

  // For readonly comments, lock the placement and vertical offset when opened so they don't change as you pan
  const lockedPlacementRef = useRef<"left" | "right" | null>(null);
  const lockedVerticalOffsetRef = useRef<number | null>(null);

  // Measure actual rendered thread height for accurate vertical positioning
  const threadContainerRef = useRef<HTMLDivElement>(null);
  const [measuredThreadHeight, setMeasuredThreadHeight] = useState<
    number | null
  >(null);
  // Track whether canvas pan has settled (for image-attached comments)
  // Offset locking is delayed until pan completes so the locked offset uses the post-pan position
  const [isPanSettled, setIsPanSettled] = useState(true);

  // Track which AI message ID we've "seen" by opening the thread
  // This persists even when thread closes, so we know which messages are "new"
  // Initialize based on is_read status - if already read, consider current message seen
  const seenMessageIdRef = useRef<string | null>(
    comment.is_read && modelMessage ? modelMessage.id : null,
  );

  // Track which message we've already started animating for
  // Initialize same as seenMessageIdRef to prevent animation on already-read threads
  const animatedMessageIdRef = useRef<string | null>(
    comment.is_read && modelMessage ? modelMessage.id : null,
  );

  // State to keep animation class applied for the full animation duration
  const [isAnimating, setIsAnimating] = useState(false);

  // Check if there's an unseen AI message (new response we haven't viewed yet)
  // This determines whether to show the notification dot and preview
  const hasUnseenAIMessage =
    modelMessage && seenMessageIdRef.current !== modelMessage.id;

  // Compute whether we should START animating SYNCHRONOUSLY during render
  // This ensures the animation class is applied on the first render where the element appears
  const shouldStartAnimation =
    modelMessage &&
    !isSelected &&
    animatedMessageIdRef.current !== modelMessage.id;

  // If we should animate, update the ref immediately (synchronous, safe in render)
  // This prevents re-triggering on subsequent renders
  if (shouldStartAnimation && modelMessage) {
    animatedMessageIdRef.current = modelMessage.id;
  }

  // Show animation class if we're starting OR still within animation duration
  const showAnimationClass = shouldStartAnimation || isAnimating;

  // When animation starts, keep the class applied for the full duration
  useEffect(() => {
    if (shouldStartAnimation) {
      setIsAnimating(true);
      // Animation duration: dot is 300ms, preview is 350ms + 100ms delay = 450ms
      const timer = setTimeout(() => {
        setIsAnimating(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [shouldStartAnimation]);

  // Mark message as "seen" when thread opens (hides notification when closing)
  useEffect(() => {
    if (isSelected && modelMessage) {
      seenMessageIdRef.current = modelMessage.id;
      animatedMessageIdRef.current = modelMessage.id;
      setIsAnimating(false);
    }
  }, [isSelected, modelMessage]);

  // Check if we're in "first generation" mode (no AI-generated content yet)
  // In this mode, we use different placeholder text and hide the pills
  const isFirstGenMode = !layout.elements.some(
    (el) => el.slot.source !== "user",
  );
  // Compute the default placeholder based on mode
  const getDefaultPlaceholder = useCallback(() => {
    if (isFirstGenMode) return FIRST_GEN_PLACEHOLDER;
    return composerMode === "chat" ? CHAT_PLACEHOLDER : FEEDBACK_PLACEHOLDER;
  }, [isFirstGenMode, composerMode]);
  const [placeholder, setPlaceholder] = useState(getDefaultPlaceholder);

  // Update placeholder when composer mode changes
  useEffect(() => {
    setPlaceholder(getDefaultPlaceholder());
    setPlaceholderKey((k) => k + 1);
  }, [composerMode, getDefaultPlaceholder]);

  const animatePlaceholder = useCallback(
    (newPlaceholder: string, delay = 0) => {
      // Clear any pending reset
      if (placeholderResetTimeoutRef.current) {
        window.clearTimeout(placeholderResetTimeoutRef.current);
        placeholderResetTimeoutRef.current = null;
      }

      const doAnimate = () => {
        if (newPlaceholder === placeholder) return;
        setPlaceholder(newPlaceholder);
        setPlaceholderKey((k) => k + 1);
      };

      if (delay > 0) {
        placeholderResetTimeoutRef.current = window.setTimeout(
          doAnimate,
          delay,
        );
      } else {
        doAnimate();
      }
    },
    [placeholder],
  );

  // show pills again when text is cleared
  useEffect(() => {
    if (text.length === 0) {
      setShowPills(true);
    }
  }, [text]);

  // Reset close attempts when comment is opened
  useEffect(() => {
    if (isSelected) {
      setCloseAttempts(0);
    }
  }, [isSelected]);

  // Mark as read when the comment is open and has a model response
  // This handles the case where the user has the comment open while the model responds
  useEffect(() => {
    if (isSelected && modelMessage && !comment.is_read) {
      updateComments({ id: comment.id, is_read: true });
    }
  }, [isSelected, modelMessage, comment.is_read, comment.id, updateComments]);

  useEffect(() => {
    const handleClick = (
      event: CustomEvent<{ id: string; openId?: string }>,
    ) => {
      if (event.detail.id !== comment.id || !isSelected) {
        return;
      }

      // Skip if this was triggered by a text selection drag
      if (isTextSelectionDraggingRef.current) {
        return;
      }

      const { openId } = event.detail;

      if (!comment.is_editable) {
        // Readonly - close and open the new comment
        setSelectedCommentId(openId ?? null);
        return;
      }

      // Check content thresholds
      const hasMinimalContent = text.trim().length < 7 && images.length === 0;
      const hasSubstantialContent =
        text.trim().length >= 7 || images.length > 0;

      if (hasMinimalContent) {
        // Less than 7 chars and no images - delete and open new
        updateComments({ id: comment.id, is_deleted: true });
        setSelectedCommentId(openId ?? null);
      } else if (hasSubstantialContent && closeAttempts === 0) {
        // First attempt with substantial content - shake (don't open new comment)
        setCloseAttempts(1);
        setIsShaking(true);
        textareaRef.current?.select();
        textareaRef.current?.focus({ preventScroll: true });
        setTimeout(() => setIsShaking(false), 400);
      } else {
        // Second+ attempt - delete and open new
        updateComments({ id: comment.id, is_deleted: true });
        setSelectedCommentId(openId ?? null);
      }
    };

    window.addEventListener("comment-clicked", handleClick as EventListener);

    return () => {
      window.removeEventListener(
        "comment-clicked",
        handleClick as EventListener,
      );
    };
  }, [
    comment,
    updateComments,
    text,
    images,
    closeAttempts,
    isSelected,
    setSelectedCommentId,
  ]);

  useEffect(() => {
    if (isSelected && !previouslySelectedRef.current) {
      setIsOpening(true);
      const timer = setTimeout(() => setIsOpening(false), 220);
      previouslySelectedRef.current = true;

      // Dispatch event to pan/zoom canvas to show attached images with room for popover
      const attachedSlotIds = comment.attached_slot_ids ?? [];
      if (attachedSlotIds.length > 0) {
        // Mark pan as unsettled - offset locking will wait until pan animation completes
        setIsPanSettled(false);
        window.dispatchEvent(
          new CustomEvent("focus-comment", {
            detail: {
              commentId: comment.id,
              attachedSlotIds,
              commentX: comment.x,
              commentY: comment.y,
            },
          }),
        );
      }

      return () => clearTimeout(timer);
    }

    if (!isSelected) {
      previouslySelectedRef.current = false;
      setIsOpening(false);
      // Clear locked placement, offset, and measurement when comment is deselected
      lockedPlacementRef.current = null;
      lockedVerticalOffsetRef.current = null;
      setMeasuredThreadHeight(null);
      setIsPanSettled(true);
    }
  }, [isSelected, comment.attached_slot_ids, comment.id, comment.x, comment.y]);

  // Measure thread height immediately for ALL comments via useLayoutEffect.
  // This fires synchronously before paint, so the user never sees the hidden state.
  useLayoutEffect(() => {
    if (!isSelected || comment.is_editable || measuredThreadHeight !== null)
      return;
    if (threadContainerRef.current) {
      setMeasuredThreadHeight(
        threadContainerRef.current.getBoundingClientRect().height,
      );
    }
  }, [isSelected, comment.is_editable, measuredThreadHeight]);

  // For image-attached comments, mark the pan as settled after the animation completes (300ms).
  // Until settled, the vertical offset recalculates dynamically as the camera moves.
  // Once settled, the offset locks at the correct post-pan position.
  useEffect(() => {
    if (isPanSettled || !isSelected || comment.is_editable) return;
    const timer = setTimeout(() => setIsPanSettled(true), 350);
    return () => clearTimeout(timer);
  }, [isPanSettled, isSelected, comment.is_editable]);

  // Handle Escape key globally for selected comments
  // For editable comments, this handles when textarea is NOT focused (e.g., after switching modes)
  // For readonly comments, this handles all Escape presses
  useEffect(() => {
    if (!isSelected) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;

      // Skip if textarea is focused (textarea's onKeyDown handles it)
      if (textareaRef.current && document.activeElement === textareaRef.current)
        return;

      e.preventDefault();

      if (!comment.is_editable) {
        // Readonly - just close
        setSelectedCommentId(null);
        return;
      }

      // Check content thresholds
      const hasMinimalContent = text.trim().length < 7 && images.length === 0;
      const hasSubstantialContent =
        text.trim().length >= 7 || images.length > 0;

      if (hasMinimalContent) {
        // Less than 7 chars and no images - delete without shaking
        updateComments({ id: comment.id, is_deleted: true });
        setSelectedCommentId(null);
      } else if (hasSubstantialContent && closeAttempts === 0) {
        // First attempt with substantial content - shake
        setCloseAttempts(1);
        setIsShaking(true);
        textareaRef.current?.select();
        textareaRef.current?.focus({ preventScroll: true });
        setTimeout(() => setIsShaking(false), 400);
      } else {
        // Second+ attempt - delete
        updateComments({ id: comment.id, is_deleted: true });
        setSelectedCommentId(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isSelected,
    comment.is_editable,
    comment.id,
    updateComments,
    setSelectedCommentId,
    text,
    images,
    closeAttempts,
  ]);

  const resizeTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, []);

  // auto-focus the textarea when the composer opens
  useEffect(() => {
    if (isSelected && comment.is_editable) {
      const timer = setTimeout(() => {
        textareaRef.current?.focus({ preventScroll: true });
        resizeTextarea();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isSelected, comment.is_editable, resizeTextarea]);

  const handleUploadImages = useCallback(async (files: FileList) => {
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
    ];

    const validFiles = Array.from(files).filter((file) =>
      allowedTypes.includes(file.type.toLowerCase()),
    );

    if (validFiles.length === 0) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploadingCount((prev) => prev + validFiles.length);

    const uploadedImages = (
      await Promise.all(
        validFiles.map((file) =>
          DRIVE_CLIENT.upload(file)
            .then((url) => {
              setUploadingCount((prev) => prev - 1);
              return { type: "image", url } as ImageContent;
            })
            .catch((e) => {
              console.error(e);
              setUploadingCount((prev) => prev - 1);
              return null;
            }),
        ),
      )
    ).filter(Boolean) as ImageContent[];

    setImages((prev) => [...prev, ...uploadedImages]);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handlePasteImage = useCallback(
    async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      if (!e.clipboardData) return;
      const items = e.clipboardData.files;
      if (items && items.length > 0) {
        e.preventDefault();
        await handleUploadImages(items);
      }
    },
    [handleUploadImages],
  );

  // Upload images for thread reply
  const handleUploadReplyImages = useCallback(async (files: FileList) => {
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
    ];

    const validFiles = Array.from(files).filter((file) =>
      allowedTypes.includes(file.type.toLowerCase()),
    );

    if (validFiles.length === 0) {
      if (replyFileInputRef.current) replyFileInputRef.current.value = "";
      return;
    }

    setReplyUploadingCount((prev) => prev + validFiles.length);

    const uploadedImages = (
      await Promise.all(
        validFiles.map((file) =>
          DRIVE_CLIENT.upload(file)
            .then((url) => {
              setReplyUploadingCount((prev) => prev - 1);
              return { type: "image", url } as ImageContent;
            })
            .catch((e) => {
              console.error(e);
              setReplyUploadingCount((prev) => prev - 1);
              return null;
            }),
        ),
      )
    ).filter(Boolean) as ImageContent[];

    setReplyImages((prev) => [...prev, ...uploadedImages]);

    if (replyFileInputRef.current) {
      replyFileInputRef.current.value = "";
    }
  }, []);

  const handlePasteReplyImage = useCallback(
    async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      if (!e.clipboardData) return;
      const items = e.clipboardData.files;
      if (items && items.length > 0) {
        e.preventDefault();
        await handleUploadReplyImages(items);
      }
    },
    [handleUploadReplyImages],
  );

  const handleRemoveReplyImage = useCallback((index: number) => {
    setReplyImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleRemoveImage = useCallback((index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handlePublish = useCallback(async () => {
    // Persist the mode preference for this thread
    threadModePreferences.set(comment.id, composerMode);

    // Update the comment to mark it as submitted
    await updateComments({
      id: comment.id,
      message: { type: "text", text },
      images: images,
      is_editable: false,
    });

    // Only trigger AI response in chat mode
    if (composerMode === "chat" && comment.source !== "ai") {
      const updatedComment: Comment = {
        ...comment,
        message: { type: "text", text },
        images: images,
        is_editable: false,
        is_submitted: true,
        source: "user",
      };

      sendRequest({
        type: "generate_comment_reply_agent_request",
        comment_id: comment.id,
        comments: [updatedComment, ...layout.comments] as Comment[],
        elements: layout.elements as Element[],
        problem: (currentDesign?.problem ?? []) as (
          | TextContent
          | ImageContent
        )[],
      });
    }

    setSelectedCommentId(null);
  }, [
    comment,
    text,
    images,
    composerMode,
    updateComments,
    setSelectedCommentId,
    layout.elements,
    layout.comments,
    currentDesign,
    sendRequest,
  ]);

  // Send a reply in a thread
  const handleSendReply = useCallback(async () => {
    if (replyText.trim().length === 0 && replyImages.length === 0) return;

    const threadId = comment.thread_id ?? comment.id;

    // Create the user's reply comment
    // is_submitted: false so the green button lights up (user reply = new feedback for revision)
    const userReply: Comment = {
      created_at: new Date().toISOString(),
      created_by: identity ?? undefined,
      id: uuidv4(),
      thread_id: threadId,
      source: "user",
      message: { type: "text", text: replyText },
      images: replyImages,
      is_deleted: false,
      is_editable: false,
      is_submitted: false,
      x: comment.x,
      y: comment.y,
    };

    // Add the user's message to the layout
    await addComment(userReply);

    // Clear the reply input and reset textarea height
    setReplyText("");
    setReplyImages([]);
    if (replyTextareaRef.current) {
      replyTextareaRef.current.style.height = "auto";
    }

    // Only trigger AI response in chat mode
    if (replyMode === "chat") {
      sendRequest({
        type: "generate_comment_reply_agent_request",
        comment_id: threadId,
        comments: [
          ...threadMessages,
          userReply,
          ...layout.comments.filter(
            (c) => c.id !== threadId && c.thread_id !== threadId,
          ),
        ] as Comment[],
        elements: layout.elements as Element[],
        problem: (currentDesign?.problem ?? []) as (
          | TextContent
          | ImageContent
        )[],
      });
    }
  }, [
    comment,
    replyText,
    replyImages,
    replyMode,
    addComment,
    threadMessages,
    layout.elements,
    layout.comments,
    currentDesign,
    sendRequest,
    identity,
  ]);

  const handleReplyKeyDown = useCallback(
    async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        // Don't allow sending while model is responding
        if (isThreadResponding) return;
        await handleSendReply();
      }
    },
    [handleSendReply, isThreadResponding],
  );

  const handleKeyDown = useCallback(
    async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();

        if (text.trim().length > 0 || images.length > 0) {
          await handlePublish();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();

        // Check content thresholds
        const hasMinimalContent = text.trim().length < 7 && images.length === 0;
        const hasSubstantialContent =
          text.trim().length >= 7 || images.length > 0;

        if (hasMinimalContent) {
          // Less than 7 chars and no images - delete without shaking
          await updateComments({ id: comment.id, is_deleted: true });
          setSelectedCommentId(null);
        } else if (hasSubstantialContent && closeAttempts === 0) {
          // First attempt with substantial content - shake
          setCloseAttempts(1);
          setIsShaking(true);
          textareaRef.current?.select();
          textareaRef.current?.focus({ preventScroll: true });
          setTimeout(() => setIsShaking(false), 400);
        } else {
          // Second+ attempt - delete
          await updateComments({ id: comment.id, is_deleted: true });
          setSelectedCommentId(null);
        }
      }
    },
    [
      text,
      images,
      handlePublish,
      comment.id,
      updateComments,
      setSelectedCommentId,
      closeAttempts,
    ],
  );

  // Get current node position from ReactFlow store (updates during drag)
  // This ensures popover repositions dynamically when dragging the comment
  // Using separate x/y selectors to avoid creating new objects that fail shallow equality
  const nodeX = useStore((s) => s.nodeInternals.get(comment.id)?.position.x);
  const nodeY = useStore((s) => s.nodeInternals.get(comment.id)?.position.y);
  const nodePosition = {
    x: nodeX ?? comment.x,
    y: nodeY ?? comment.y,
  };

  // Track viewport dimensions reactively for popover positioning
  const [viewportWidth, setViewportWidth] = useState(window.innerWidth);
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
  useEffect(() => {
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
      setViewportHeight(window.innerHeight);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Screen position of the comment bubble (uses node position for drag updates)
  const screenX = nodePosition.x * zoom + tx;
  const screenY = nodePosition.y * zoom + ty;

  // HORIZONTAL: Prefer placement that avoids overlapping attached images
  const rightBoundary = viewportWidth;
  const spaceOnRight = rightBoundary - screenX;
  const fitsOnRight = spaceOnRight >= POPOVER_WIDTH + POPOVER_GAP + 10; // 10px margin
  const fitsOnLeft = screenX >= POPOVER_WIDTH + POPOVER_GAP + 10;

  // Find attached image elements to determine optimal placement
  const attachedElements = useMemo(() => {
    const attachedSlotIds = comment.attached_slot_ids ?? [];
    if (attachedSlotIds.length === 0) return [];
    return layout.elements.filter(
      (el) =>
        attachedSlotIds.includes(el.slot.id) &&
        el.slot.content_type === "image",
    );
  }, [comment.attached_slot_ids, layout.elements]);

  // Determine if attached images are primarily to the right or left of the comment
  // An image is "to the right" if its right edge extends past where the popover would open
  const popoverWouldOverlapRight = attachedElements.some((el) => {
    const imageRight = el.slot.x + el.slot.width;
    const popoverStartX = nodePosition.x + POPOVER_GAP;
    // Image overlaps if it extends into the popover area
    return (
      imageRight > popoverStartX && el.slot.x < popoverStartX + POPOVER_WIDTH
    );
  });

  const popoverWouldOverlapLeft = attachedElements.some((el) => {
    const popoverEndX = nodePosition.x - POPOVER_GAP;
    const popoverStartX = popoverEndX - POPOVER_WIDTH;
    // Image overlaps if it's in the popover area
    return el.slot.x < popoverEndX && el.slot.x + el.slot.width > popoverStartX;
  });

  // Choose placement: prioritize avoiding image overlap, then screen boundaries
  let calculatedPlacement: "left" | "right";
  if (popoverWouldOverlapRight && !popoverWouldOverlapLeft && fitsOnLeft) {
    // Images are to the right, open left to avoid blocking them
    calculatedPlacement = "left";
  } else if (
    popoverWouldOverlapLeft &&
    !popoverWouldOverlapRight &&
    fitsOnRight
  ) {
    // Images are to the left, open right to avoid blocking them
    calculatedPlacement = "right";
  } else if (!popoverWouldOverlapRight && fitsOnRight) {
    // No overlap on right and it fits, use right (default)
    calculatedPlacement = "right";
  } else if (!popoverWouldOverlapLeft && fitsOnLeft) {
    // No overlap on left and it fits, use left
    calculatedPlacement = "left";
  } else {
    // Both would overlap or neither fits well - fall back to screen boundary logic
    calculatedPlacement = fitsOnRight ? "right" : "left";
  }

  // For readonly comments, lock the placement when first opened so it doesn't flip as you pan
  // For editable comments (composers), always recalculate so it stays on screen
  let placement: "left" | "right";
  if (!comment.is_editable && isSelected) {
    // Readonly: use locked placement if available, otherwise lock it
    if (lockedPlacementRef.current === null) {
      // Comments with attached images always open on the left
      // (the canvas pans to make room via focus-comment event)
      const hasAttachedImages = (comment.attached_slot_ids ?? []).length > 0;
      lockedPlacementRef.current = hasAttachedImages
        ? "left"
        : calculatedPlacement;
    }
    placement = lockedPlacementRef.current;
  } else {
    // Editable: always use calculated placement
    placement = calculatedPlacement;
  }

  // Calculate where popover would be positioned
  const popoverLeft =
    placement === "right"
      ? screenX + POPOVER_GAP
      : screenX - POPOVER_GAP - POPOVER_WIDTH;
  const popoverRight = popoverLeft + POPOVER_WIDTH;

  // HORIZONTAL OFFSET: Keep popover on screen
  let horizontalOffset = 0;
  if (popoverRight > rightBoundary - 10) {
    // Would go off right edge - shift left
    horizontalOffset = rightBoundary - 10 - popoverRight;
  } else if (popoverLeft < 10) {
    // Would go off left edge - shift right
    horizontalOffset = 10 - popoverLeft;
  }

  // VERTICAL: Calculate popover vertical position
  const popoverTop = screenY - 22; // CSS margin-top offset
  const popoverBottom = popoverTop + POPOVER_HEIGHT;

  // Measure actual floating bar position from DOM (handles expanded planning section)
  const floatingBarEl = document.querySelector(".design-page-floating-bar");
  const floatingBarRect = floatingBarEl?.getBoundingClientRect();
  const floatingBarTop = floatingBarRect
    ? floatingBarRect.top
    : viewportHeight - FLOATING_BAR_HEIGHT;
  const floatingBarLeft = floatingBarRect
    ? floatingBarRect.left
    : (viewportWidth - FLOATING_BAR_WIDTH) / 2;
  const floatingBarRight = floatingBarRect
    ? floatingBarRect.right
    : floatingBarLeft + FLOATING_BAR_WIDTH;

  // Measure bottom-right controls position from DOM
  const controlsEl = document.querySelector(
    ".comments-sidebar-controls-floating",
  );
  const controlsRect = controlsEl?.getBoundingClientRect();

  // Measure top-right Share button position from DOM
  const shareEl = document.querySelector(".comments-sidebar-share-floating");
  const shareRect = shareEl?.getBoundingClientRect();

  // VERTICAL OFFSET: Avoid floating bar, bottom-right controls, and stay on screen
  let verticalOffset = 0;

  // For readonly threads: use the measured height to position accurately.
  // Before measurement, verticalOffset stays 0 (thread is hidden).
  // After measurement, shift up only the minimum needed to keep the thread in bounds.
  if (!comment.is_editable && isSelected) {
    const availableTop = HEADER_HEIGHT + 10;
    const availableBottom = floatingBarTop - 24;

    if (measuredThreadHeight !== null) {
      // We have the actual height - position precisely
      const threadBottom = popoverTop + measuredThreadHeight;

      // If thread bottom would go past the floating bar, shift up
      if (threadBottom > availableBottom) {
        verticalOffset = availableBottom - threadBottom;
      }
      // Don't shift above the header
      if (popoverTop + verticalOffset < availableTop) {
        verticalOffset = availableTop - popoverTop;
      }
    }
    // If not measured yet, verticalOffset stays 0 (thread is hidden anyway)
  } else {
    // Editable comments - use original logic
    const overlapsFloatingBarHorizontally =
      popoverRight + horizontalOffset > floatingBarLeft &&
      popoverLeft + horizontalOffset < floatingBarRight;

    // Check if popover overlaps with bottom-right controls
    const overlapsControlsHorizontally = controlsRect
      ? popoverRight + horizontalOffset > controlsRect.left &&
        popoverLeft + horizontalOffset < controlsRect.right
      : false;
    const overlapsControls =
      overlapsControlsHorizontally && controlsRect
        ? popoverBottom > controlsRect.top
        : false;

    // Check if popover overlaps with top-right Share button
    const overlapsShareHorizontally = shareRect
      ? popoverRight + horizontalOffset > shareRect.left &&
        popoverLeft + horizontalOffset < shareRect.right
      : false;
    const overlapsShare =
      overlapsShareHorizontally && shareRect
        ? popoverTop < shareRect.bottom
        : false;

    if (overlapsFloatingBarHorizontally && popoverBottom > floatingBarTop) {
      // Shift up so popover bottom is above floating bar
      verticalOffset = floatingBarTop - popoverBottom - 10;
    } else if (overlapsControls && controlsRect) {
      // Shift up so popover bottom is above controls
      verticalOffset = controlsRect.top - popoverBottom - 10;
    } else if (popoverBottom > viewportHeight - 10) {
      // Would go off bottom edge - shift up
      verticalOffset = viewportHeight - 10 - popoverBottom;
    }

    // Also shift down if popover would go above header or overlap with Share button
    const minTop =
      overlapsShare && shareRect ? shareRect.bottom + 10 : HEADER_HEIGHT;
    if (popoverTop + verticalOffset < minTop) {
      verticalOffset = minTop - popoverTop;
    }
  }

  // For readonly comments, lock the vertical offset once measured and pan settled
  // Before locking, the offset recalculates dynamically (needed during canvas pan animation)
  let finalVerticalOffset = verticalOffset;
  if (!comment.is_editable && isSelected) {
    if (
      lockedVerticalOffsetRef.current === null &&
      measuredThreadHeight !== null &&
      isPanSettled
    ) {
      lockedVerticalOffsetRef.current = verticalOffset;
    }
    finalVerticalOffset = lockedVerticalOffsetRef.current ?? verticalOffset;
  }

  // deleted
  if (comment.is_deleted) {
    return null;
  }

  // Handler for clicking unselected comment icon
  const handleIconClick = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // Mark as read if there's a model message and not already read
    if (modelMessage && !comment.is_read) {
      await updateComments({ id: comment.id, is_read: true });
    }

    if (!selectedCommentId) {
      // No comment selected - open this one
      setSelectedCommentId(comment.id);
      return;
    }

    // Another comment is selected - dispatch comment-clicked to it
    // This will shake if composing with content, or close/delete and open this one otherwise
    window.dispatchEvent(
      new CustomEvent("comment-clicked", {
        detail: { id: selectedCommentId, openId: comment.id },
      }),
    );
  };

  const getIconColors = (): { fill: string; stroke: string } => {
    if (!isSelected) {
      return { fill: "#F9F7F4", stroke: "#453321" };
    }
    const mode = comment.is_editable ? composerMode : replyMode;
    return mode === "chat"
      ? { fill: "#FCE4EB", stroke: "#EC497B" }
      : { fill: "#E2E4D7", stroke: "#627532" };
  };

  // Render the icon consistently across all states
  // This prevents the flash when transitioning between selected/unselected
  const renderIcon = () => {
    // Compute mode once for cleaner class logic
    const mode = comment.is_editable ? composerMode : replyMode;
    const thinkingDotsClass = isSelected
      ? mode === "chat"
        ? " comment-node-thinking-dots-chat"
        : " comment-node-thinking-dots-selected"
      : "";

    return (
      <div
        className={`comment-node-icon-fixed${isSelected ? " comment-node-icon-selected" : ""}`}
      >
        <CommentBubbleIcon {...getIconColors()} />
        {isThreadResponding && (
          <div className={`comment-node-thinking-dots${thinkingDotsClass}`}>
            <span className="comment-node-thinking-dot" />
            <span className="comment-node-thinking-dot" />
            <span className="comment-node-thinking-dot" />
          </div>
        )}
        {!isSelected &&
          modelMessage &&
          (hasUnseenAIMessage || !comment.is_read) && (
            <div
              className={`comment-node-notification-dot${showAnimationClass ? " comment-node-notification-dot-animate" : ""}`}
            />
          )}
      </div>
    );
  };

  // not selected
  if (!isSelected) {
    // All unselected states use the same base structure for consistent positioning
    return (
      <div
        className="comment-node-anchor"
        style={{
          transform: `scale(${1 / zoom})`,
          transformOrigin: "top left",
        }}
        onClick={handleIconClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {renderIcon()}
        {modelMessage && (hasUnseenAIMessage || !comment.is_read) ? (
          <div
            key={`unread-${modelMessage.id}`}
            className={`comment-node-preview-bubble${showAnimationClass ? " comment-node-preview-animate" : ""}`}
          >
            <div className="comment-node-preview-text">
              {modelMessage.message.text}
            </div>
          </div>
        ) : (
          !comment.is_editable &&
          threadMessages.length > 0 &&
          threadMessages[0].message.text && (
            <div
              key="hover-preview"
              className="comment-node-preview-bubble comment-node-preview-bubble-hover"
            >
              <div className="comment-node-preview-text">
                {threadMessages[0].message.text}
              </div>
            </div>
          )
        )}
      </div>
    );
  }

  // selected but not editable - show thread view
  // Readonly comments don't follow the viewport - they can scroll off screen
  if (!comment.is_editable && isSelected) {
    const _hasThread = threadMessages.length > 1 || modelMessage;

    return (
      <div
        className="comment-node-wrapper"
        data-placement={placement}
        style={{
          transform: `scale(${1 / zoom})`,
          transformOrigin: "top left",
          // @ts-expect-error CSS custom properties
          // Apply locked vertical offset to fit in viewport on open, then stay fixed
          "--vertical-offset": `${finalVerticalOffset}px`,
          "--horizontal-offset": "0px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {renderIcon()}
        <div
          ref={threadContainerRef}
          className={`comment-node comment-node-readonly comment-node-thread nodrag nopan${isOpening ? " comment-node-open" : ""}`}
          style={
            measuredThreadHeight === null
              ? { visibility: "hidden" as const }
              : undefined
          }
        >
          <div
            className={`comment-node-readonly-actions${isThreadScrollable ? " comment-node-readonly-actions-scrollable" : ""}`}
          >
            <button
              className="comment-node-readonly-action"
              type="button"
              onClick={async () => {
                // Delete all messages in the thread, not just the root comment
                await updateComments(
                  ...threadMessages.map((msg) => ({
                    id: msg.id,
                    is_deleted: true,
                  })),
                );
                setSelectedCommentId(null);
              }}
            >
              <Trash2Icon size={16} />
            </button>
            <button
              className="comment-node-readonly-action"
              type="button"
              onClick={() => setSelectedCommentId(null)}
            >
              <XIcon size={16} />
            </button>
          </div>

          {/* Thread messages */}
          <div
            className={`comment-node-thread-messages${isThreadScrollable ? " comment-node-thread-messages-scrollable" : ""}`}
            ref={threadMessagesRef}
          >
            {threadMessages.map((msg, _idx) => (
              <div key={msg.id} className="comment-node-thread-message">
                {msg.source === "ai" ? (
                  <div className="comment-node-avatar comment-node-avatar-ai">
                    <img
                      src="https://drive.orianna.ai/d2fa3c450459b368734c24a9707499cf.png"
                      alt="Softlight"
                      width={24}
                      height={24}
                    />
                  </div>
                ) : (
                  (() => {
                    const author = msg.created_by ?? identity;
                    return (
                      <div className="comment-node-avatar comment-node-avatar-user">
                        {author?.picture ? (
                          <img
                            src={author.picture}
                            alt={author.name ?? undefined}
                            width={24}
                            height={24}
                          />
                        ) : (
                          <span className="comment-node-avatar-initials">
                            {getInitial(author?.name ?? "")}
                          </span>
                        )}
                      </div>
                    );
                  })()
                )}
                <div className="comment-node-thread-message-content">
                  <span className="comment-node-thread-message-author">
                    {msg.source === "ai"
                      ? "Softlight"
                      : (msg.created_by ?? identity)?.email === identity?.email
                        ? "You"
                        : ((msg.created_by ?? identity)?.name ??
                          (msg.created_by ?? identity)?.email ??
                          "Someone")}
                  </span>
                  <div
                    className="comment-node-thread-message-text"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      isTextSelectionDraggingRef.current = true;
                      const handleMouseUp = () => {
                        setTimeout(() => {
                          isTextSelectionDraggingRef.current = false;
                        }, 0);
                        window.removeEventListener("mouseup", handleMouseUp);
                      };
                      window.addEventListener("mouseup", handleMouseUp);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <Markdown>{msg.message.text}</Markdown>
                  </div>
                  {msg.images && msg.images.length > 0 && (
                    <div className="comment-node-thread-message-images">
                      {msg.images.map((image, i) => (
                        <img
                          key={i}
                          className="comment-node-readonly-image"
                          src={image.url}
                          crossOrigin="anonymous"
                          onClick={() => setModalImageUrl(image.url)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Loading indicator when model is responding */}
            {isThreadResponding && (
              <div className="comment-node-thread-message comment-node-thread-message-loading">
                <div className="comment-node-avatar comment-node-avatar-ai">
                  <img
                    src="https://drive.orianna.ai/d2fa3c450459b368734c24a9707499cf.png"
                    alt="Softlight"
                    width={24}
                    height={24}
                  />
                </div>
                <div className="comment-node-thread-message-content">
                  <span className="comment-node-thread-message-author">
                    Softlight
                  </span>
                  <div className="comment-node-thread-message-text comment-node-thinking-text">
                    <span className="comment-node-thinking-shimmer">
                      Thinking...
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Reply input */}
          <div className="comment-node-thread-reply">
            <textarea
              ref={replyTextareaRef}
              className="comment-node-thread-reply-input nopan nodrag fs-unmask"
              placeholder={
                replyMode === "chat" ? CHAT_PLACEHOLDER : FEEDBACK_PLACEHOLDER
              }
              value={replyText}
              onChange={(e) => {
                setReplyText(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${e.target.scrollHeight}px`;
              }}
              onKeyDown={handleReplyKeyDown}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onPaste={handlePasteReplyImage}
            />
            {(replyImages.length > 0 || replyUploadingCount > 0) && (
              <div className="comment-node-thread-reply-images">
                {replyImages.map((image, i) => (
                  <div key={i} className="comment-node-image-wrap">
                    <img
                      className="comment-node-image"
                      src={image.url}
                      crossOrigin="anonymous"
                      onClick={() => setModalImageUrl(image.url)}
                    />
                    <button
                      type="button"
                      className="comment-node-remove-image"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveReplyImage(i);
                      }}
                      aria-label="Remove Image"
                    >
                      <XIcon size={16} />
                    </button>
                  </div>
                ))}
                {Array.from({ length: replyUploadingCount }).map((_, i) => (
                  <div
                    key={`loading-${i}`}
                    className="comment-node-image-loading"
                  >
                    <Loader2Icon
                      size={20}
                      className="comment-node-loading-spinner"
                    />
                  </div>
                ))}
              </div>
            )}
            <div className="comment-node-thread-reply-actions">
              <button
                className={`comment-node-chat-toggle${replyMode === "chat" ? " comment-node-chat-toggle-active" : ""}`}
                type="button"
                onClick={() => {
                  setReplyMode(replyMode === "chat" ? "feedback" : "chat");
                  replyTextareaRef.current?.focus({ preventScroll: true });
                }}
              >
                Chat
              </button>
              <div className="comment-node-thread-reply-buttons">
                <button
                  className="comment-node-action comment-node-action-add"
                  type="button"
                  onClick={() => replyFileInputRef.current?.click()}
                >
                  <ImageIcon size={16} />
                </button>
                <button
                  className={`comment-node-action comment-node-action-send${(replyText.trim().length === 0 && replyImages.length === 0) || isThreadResponding ? " comment-node-action-send-disabled" : replyMode === "chat" ? " comment-node-action-send-chat" : ""}`}
                  type="button"
                  onClick={handleSendReply}
                  disabled={isThreadResponding}
                >
                  <ArrowUpIcon size={18} />
                </button>
              </div>
            </div>
            <input
              ref={replyFileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
              multiple
              style={{ display: "none" }}
              onChange={async (e) => {
                if (e.target.files) {
                  await handleUploadReplyImages(e.target.files);
                }
              }}
            />
          </div>
        </div>
        <ImageModal
          imageUrl={modalImageUrl}
          onClose={() => setModalImageUrl(null)}
        />
      </div>
    );
  }

  // selected and editable
  return (
    <div
      className="comment-node-wrapper"
      data-placement={placement}
      style={{
        transform: `scale(${1 / zoom})`,
        transformOrigin: "top left",
        // @ts-expect-error CSS custom properties
        "--vertical-offset": `${verticalOffset}px`,
        "--horizontal-offset": `${horizontalOffset}px`,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {renderIcon()}
      <div className="comment-node-shake-wrapper">
        <div
          className={`comment-node-shadow-wrapper${isOpening ? " comment-node-open" : ""}`}
        >
          <div
            className={`comment-node${images.length > 0 || uploadingCount > 0 ? " comment-node-with-images" : ""}${isShaking ? " comment-node-shake" : ""}`}
          >
            <div
              ref={commentBodyRef}
              className="comment-node-body nopan nodrag"
            >
              <div className="comment-node-input-wrapper">
                <textarea
                  ref={textareaRef}
                  className="comment-node-input nopan nodrag fs-unmask"
                  autoFocus
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    resizeTextarea();
                  }}
                  onKeyDown={handleKeyDown}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    isTextSelectionDraggingRef.current = true;
                    const handleMouseUp = () => {
                      setTimeout(() => {
                        isTextSelectionDraggingRef.current = false;
                      }, 0);
                      window.removeEventListener("mouseup", handleMouseUp);
                    };
                    window.addEventListener("mouseup", handleMouseUp);
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onPaste={handlePasteImage}
                />
                {text.length === 0 && (
                  <span
                    key={placeholderKey}
                    className="comment-node-placeholder"
                  >
                    {placeholder}
                  </span>
                )}
              </div>
            </div>
            {(images.length > 0 || uploadingCount > 0) && (
              <div className="comment-node-images">
                {images.map((image, i) => (
                  <div key={i} className="comment-node-image-wrap">
                    <img
                      className="comment-node-image"
                      src={image.url}
                      crossOrigin="anonymous"
                      onClick={() => setModalImageUrl(image.url)}
                    />
                    <button
                      type="button"
                      className="comment-node-remove-image"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveImage(i);
                      }}
                      aria-label="Remove Image"
                    >
                      <XIcon size={16} />
                    </button>
                  </div>
                ))}
                {Array.from({ length: uploadingCount }).map((_, i) => (
                  <div
                    key={`loading-${i}`}
                    className="comment-node-image-loading"
                  >
                    <Loader2Icon
                      size={20}
                      className="comment-node-loading-spinner"
                    />
                  </div>
                ))}
              </div>
            )}
            <div className="comment-node-actions">
              <button
                className={`comment-node-chat-toggle${composerMode === "chat" ? " comment-node-chat-toggle-active" : ""}`}
                type="button"
                onClick={() => {
                  setComposerMode(
                    composerMode === "chat" ? "feedback" : "chat",
                  );
                  textareaRef.current?.focus({ preventScroll: true });
                }}
              >
                Chat
              </button>
              <div className="comment-node-action-buttons">
                <button
                  className="comment-node-action comment-node-action-add"
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImageIcon size={16} />
                </button>
                <button
                  className={`comment-node-action comment-node-action-send${text.trim().length === 0 && images.length === 0 ? " comment-node-action-send-disabled" : composerMode === "chat" ? " comment-node-action-send-chat" : ""}`}
                  type="button"
                  onClick={handlePublish}
                >
                  <ArrowUpIcon size={18} />
                </button>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
              multiple
              style={{ display: "none" }}
              onChange={async (e) => {
                if (e.target.files) {
                  await handleUploadImages(e.target.files);
                }
              }}
            />
          </div>
          {showPills &&
            text.length === 0 &&
            !isFirstGenMode &&
            composerMode === "feedback" && (
              <div className="comment-node-pills">
                <button
                  className="comment-node-pill"
                  type="button"
                  onMouseEnter={() =>
                    animatePlaceholder(PILL_PLACEHOLDERS["Describe issue"])
                  }
                  onMouseLeave={() =>
                    animatePlaceholder(getDefaultPlaceholder(), 100)
                  }
                  onClick={() => {
                    setText(PILL_PLACEHOLDERS["Describe issue"]);
                    resizeTextarea();
                    setShowPills(false);
                    setPlaceholder(getDefaultPlaceholder());
                    textareaRef.current?.focus({ preventScroll: true });
                  }}
                >
                  <AlertCircleIcon size={14} />
                  <span>Problems</span>
                </button>
                <button
                  className="comment-node-pill"
                  type="button"
                  onMouseEnter={() =>
                    animatePlaceholder(PILL_PLACEHOLDERS["Request flows"])
                  }
                  onMouseLeave={() =>
                    animatePlaceholder(getDefaultPlaceholder(), 100)
                  }
                  onClick={() => {
                    setText(PILL_PLACEHOLDERS["Request flows"]);
                    resizeTextarea();
                    setShowPills(false);
                    setPlaceholder(getDefaultPlaceholder());
                    textareaRef.current?.focus({ preventScroll: true });
                  }}
                >
                  <WorkflowIcon size={14} />
                  <span>Flows</span>
                </button>
                <button
                  className="comment-node-pill"
                  type="button"
                  onMouseEnter={() =>
                    animatePlaceholder(PILL_PLACEHOLDERS["Add constraints"])
                  }
                  onMouseLeave={() =>
                    animatePlaceholder(getDefaultPlaceholder(), 100)
                  }
                  onClick={() => {
                    setText(PILL_PLACEHOLDERS["Add constraints"]);
                    resizeTextarea();
                    setShowPills(false);
                    setPlaceholder(getDefaultPlaceholder());
                    textareaRef.current?.focus({ preventScroll: true });
                  }}
                >
                  <SlidersHorizontalIcon size={14} />
                  <span>Constraints</span>
                </button>
                <button
                  className="comment-node-pill"
                  type="button"
                  onMouseEnter={() =>
                    animatePlaceholder(PILL_PLACEHOLDERS["Design system"])
                  }
                  onMouseLeave={() =>
                    animatePlaceholder(getDefaultPlaceholder(), 100)
                  }
                  onClick={() => {
                    setText(PILL_PLACEHOLDERS["Design system"]);
                    resizeTextarea();
                    setShowPills(false);
                    setPlaceholder(getDefaultPlaceholder());
                    textareaRef.current?.focus({ preventScroll: true });
                  }}
                >
                  <PaletteIcon size={14} />
                  <span>Design system</span>
                </button>
              </div>
            )}
        </div>
      </div>
      <ImageModal
        imageUrl={modalImageUrl}
        onClose={() => setModalImageUrl(null)}
      />
    </div>
  );
};

export default CommentNode;
