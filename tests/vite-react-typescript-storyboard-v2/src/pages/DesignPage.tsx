import {
  type ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { v4 as uuidv4 } from "uuid";

import { ChatBubbleIcon } from "../icons.tsx";
import { HandIcon } from "../icons.tsx";
import { Loader2Icon } from "../icons.tsx";
import { MousePointer2Icon } from "../icons.tsx";
import { PaintbrushIcon } from "../icons.tsx";
import { SparklesIcon } from "../icons.tsx";
import { TypeIcon } from "../icons.tsx";
import { XIcon } from "../icons.tsx";
import type { Comment, Reasoning } from "../api/types.gen.ts";
import {
  GRID_SIZE,
  IMAGE_HEIGHT,
  REVISION_GAP,
  SLOT_WIDTH,
} from "../api/layout";
import Canvas from "../components/canvas/Canvas";
import DesignSection from "../components/chat/messages/DesignSection";
import CommentsSidebar from "../components/comments-sidebar/CommentsSidebar";
import DesignPageHeader from "../components/design-page-header/DesignPageHeader";
import PaywallModal from "../components/paywall-modal/PaywallModal";
import { MOCK_DELAY_MS } from "../constants/mockDelays.ts";
import { useAgent } from "../hooks/useAgent";
import { type CanvasMode, useCanvasMode } from "../hooks/useCanvasMode";
import { useDesigns } from "../hooks/useDesigns";
import { useLayout } from "../hooks/useLayout";
import { usePaywall } from "../hooks/usePaywall";
import { createInitialPlaceholderElements } from "../utils/createInitialPlaceholderElements";
import { createUserInputElements } from "../utils/createUserInputElements";
import { getDesignId } from "../utils/getDesignId";
import { sanitizeElements } from "../utils/sanitizeElements";

import "./DesignPage.css";

type ModeButton = {
  mode: CanvasMode;
  icon: React.ReactNode;
  label: string;
  shortcut: string;
};

const MODE_BUTTONS: ModeButton[] = [
  {
    mode: "comment",
    icon: <ChatBubbleIcon size={20} />,
    label: "Comment",
    shortcut: "C",
  },
  {
    mode: "select",
    icon: <MousePointer2Icon size={20} />,
    label: "Select",
    shortcut: "V",
  },
  {
    mode: "pan",
    icon: <HandIcon size={20} />,
    label: "Pan",
    shortcut: "H",
  },
  {
    mode: "text",
    icon: <TypeIcon size={20} />,
    label: "Text",
    shortcut: "T",
  },
];

const INITIAL_PLACEHOLDER_IDS = [
  "title",
  "desc",
  "img-0",
  "img-0-desc",
  "img-1",
  "img-1-desc",
  "img-2",
  "img-2-desc",
];

function DesignPage(): ReactElement {
  const {
    agent,
    isResponding,
    activeIterationCount,
    sendRequest,
    currentRequest,
    cancelAllRequests,
  } = useAgent();
  const { mode, setMode } = useCanvasMode();

  const { currentDesign, cloneDesign, updateDesign } = useDesigns();
  const designId = getDesignId();

  const { layout, updateComments, updateElements, deleteElements } =
    useLayout();

  const currentUrl = typeof window !== "undefined" ? window.location.href : "/";
  const {
    showPaywall,
    paywallData,
    checkPaywall,
    handleUpgrade,
    closePaywall,
  } = usePaywall({
    successUrl: currentUrl,
    cancelUrl: currentUrl,
  });

  const [showLoading, setShowLoading] = useState<boolean>(false);
  const loadingTimeoutRef = useRef<number | null>(null);

  const [showSuccessToast, setShowSuccessToast] = useState<boolean>(false);
  const [isExiting, setIsExiting] = useState<boolean>(false);

  const [showTimeoutBanner, setShowTimeoutBanner] = useState<boolean>(false);
  const [confirmCancel, setConfirmCancel] = useState<boolean>(false);

  const canvasContainerRef = useRef<HTMLDivElement | null>(null);

  const progressSectionRef = useRef<HTMLDivElement | null>(null);
  const currentHeightRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);

  const contentWrapperRefCallback = useCallback(
    (wrapper: HTMLDivElement | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }

      if (!wrapper) {
        currentHeightRef.current = 0;
        return;
      }

      requestAnimationFrame(() => {
        const container = progressSectionRef.current;
        if (!container) {
          return;
        }

        const verticalPadding = 16;

        const observer = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const borderBoxHeight = entry.borderBoxSize?.[0]?.blockSize;
            const contentRectHeight = entry.contentRect.height;
            const newContentHeight = borderBoxHeight ?? contentRectHeight;
            const oldContentHeight = currentHeightRef.current;

            if (oldContentHeight === 0) {
              currentHeightRef.current = newContentHeight;
              container.style.height = `${newContentHeight + verticalPadding}px`;
              return;
            }

            if (Math.abs(newContentHeight - oldContentHeight) < 2) {
              return;
            }

            if (animationFrameRef.current) {
              cancelAnimationFrame(animationFrameRef.current);
            }

            animationFrameRef.current = requestAnimationFrame(() => {
              container.style.transition =
                "height 300ms cubic-bezier(0.4, 0, 0.2, 1)";
              container.style.height = `${newContentHeight + verticalPadding}px`;
              currentHeightRef.current = newContentHeight;
            });
          }
        });

        observer.observe(wrapper);
        observerRef.current = observer;
      });
    },
    [],
  );

  const toastTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.deltaX !== 0) {
        e.preventDefault();
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, []);

  const feedback = useMemo(
    () => layout.comments.filter((c) => !c.is_deleted),
    [layout.comments],
  );

  const handleCancelClick = useCallback(() => {
    cancelAllRequests();

    setShowTimeoutBanner(false);
    setConfirmCancel(false);
  }, [cancelAllRequests]);

  const handleTimeoutCancelClick = useCallback(() => {
    if (!confirmCancel) {
      setConfirmCancel(true);
      return;
    }
    handleCancelClick();
  }, [confirmCancel, handleCancelClick]);

  const isFirstGeneration =
    !currentDesign?.problem || currentDesign.problem.length === 0;

  const hasAIGeneratedContent = layout.elements.some(
    (el) => el.slot.source !== "user",
  );

  const showFirstGenStates = isFirstGeneration || !hasAIGeneratedContent;

  const firstGenContent = useMemo(() => {
    const hasTextInComments = feedback.some(
      (c) => c.message.text.trim().length > 0,
    );

    const hasTextOnCanvas = layout.elements.some(
      (el) =>
        el.slot.source === "user" &&
        el.content?.type === "text" &&
        el.content.text.trim().length > 0 &&
        el.content.text !== "Text",
    );

    const hasImageInComments = feedback.some((c) => c.images.length > 0);

    const hasImageOnCanvas = layout.elements.some(
      (el) =>
        el.slot.source === "user" &&
        el.content?.type === "image" &&
        el.content.url &&
        el.content.url.length > 0,
    );

    return {
      hasText: hasTextInComments || hasTextOnCanvas,
      hasImage: hasImageInComments || hasImageOnCanvas,
    };
  }, [feedback, layout.elements]);

  const canSubmit = feedback.some(
    (c: Comment) => !c.is_submitted && !c.is_editable,
  );

  const canTriggerGeneration = showFirstGenStates
    ? firstGenContent.hasText && firstGenContent.hasImage
    : canSubmit;

  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!isResponding) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [isResponding]);

  const currentResponse = useMemo(() => {
    return [...agent.history]
      .reverse()
      .find((e) => e.type === "generate_revision_agent_response");
  }, [agent.history]);

  const _showPendingDesign = useMemo(() => {
    if (!isResponding) return false;
    if (
      !currentResponse ||
      currentResponse.type !== "generate_revision_agent_response"
    )
      return true;
    return (
      !currentResponse.slots_reasoning ||
      Object.keys(currentResponse.slots_reasoning).length === 0
    );
  }, [isResponding, currentResponse]);

  const showDesignSection = useMemo(() => {
    if (!isResponding || !currentRequest) return false;
    if (
      !currentResponse ||
      currentResponse.type !== "generate_revision_agent_response"
    )
      return false;
    const hasSlotsReasoning =
      currentResponse.slots_reasoning &&
      Object.keys(currentResponse.slots_reasoning).length > 0;
    const hasElementsReasoning =
      currentResponse.elements_reasoning &&
      Object.keys(currentResponse.elements_reasoning).length > 0;
    return hasSlotsReasoning || hasElementsReasoning;
  }, [isResponding, currentRequest, currentResponse]);

  useEffect(() => {
    const waitingForReasoning = isResponding && !showDesignSection;

    if (!waitingForReasoning || !currentRequest?.createdAt) {
      setShowTimeoutBanner(false);
      setConfirmCancel(false);
      return;
    }

    const startTime = new Date(currentRequest.createdAt).getTime();
    const elapsed = Date.now() - startTime;
    const delay = 45 * 1000;
    const remaining = delay - elapsed;

    if (remaining <= 0) {
      setShowTimeoutBanner(true);
      return;
    }

    const timeout = window.setTimeout(() => {
      setShowTimeoutBanner(true);
    }, remaining);

    return () => window.clearTimeout(timeout);
  }, [isResponding, showDesignSection, currentRequest?.createdAt]);

  const isDesignComplete = useMemo(() => {
    if (
      !currentResponse ||
      currentResponse.type !== "generate_revision_agent_response"
    )
      return true;

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
      currentResponse.slots_reasoning &&
      Object.values(currentResponse.slots_reasoning).every(
        (r: Reasoning) => r.completed_at,
      );
    const allElementsReasoningComplete =
      currentResponse.elements_reasoning &&
      Object.keys(currentResponse.elements_reasoning).length > 0 &&
      Object.values(currentResponse.elements_reasoning).every(
        (r: Reasoning) => r.completed_at || isReasoningDelayed(r),
      );

    return (
      !isResponding ||
      (allSlotsReasoningComplete && allElementsReasoningComplete)
    );
  }, [currentResponse, isResponding, now]);

  const showDesigningInContainer = isResponding && !isDesignComplete;

  const wasDesigningRef = useRef<boolean>(false);

  useEffect(() => {
    if (showDesigningInContainer) {
      wasDesigningRef.current = true;
    }

    if (wasDesigningRef.current && !showDesigningInContainer && isResponding) {
      setShowSuccessToast(true);
      wasDesigningRef.current = false;

      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current);
      }

      toastTimeoutRef.current = window.setTimeout(() => {
        setIsExiting(true);
        toastTimeoutRef.current = null;
        setTimeout(() => {
          setShowSuccessToast(false);
          setIsExiting(false);
        }, 300);
      }, 5000);
    }

    if (!isResponding) {
      wasDesigningRef.current = false;
    }
  }, [showDesigningInContainer, isResponding]);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const handleDismissToast = useCallback(() => {
    setIsExiting(true);
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = null;
    }
    setTimeout(() => {
      setShowSuccessToast(false);
      setIsExiting(false);
    }, 300);
  }, []);

  const handleViewMocks = useCallback(() => {
    window.dispatchEvent(new CustomEvent("pan-to-latest"));
    handleDismissToast();
  }, [handleDismissToast]);

  const handleDesignNextRev = useCallback(async () => {
    if (!currentDesign) {
      return;
    }

    try {
      const shouldShowPaywall = await checkPaywall();
      if (shouldShowPaywall) {
        return;
      }

      window.dispatchEvent(new CustomEvent("focus-new-design"));

      let problem = currentDesign.problem;
      let elements = [...layout.elements];
      let comments = feedback;

      const hasAnyAIContent = layout.elements.some(
        (el) => el.slot.source !== "user",
      );
      if (currentDesign.problem.length === 0 || !hasAnyAIContent) {
        const filteredElements = layout.elements.filter(
          (e) =>
            (e.slot.source === "user" ||
              (e.slot.source === undefined &&
                (e.slot.id.startsWith("user-text-") ||
                  e.slot.id.startsWith("user-input-") ||
                  e.slot.id.startsWith("pasted-")))) &&
            e.content != null,
        );

        const contentFromElements = filteredElements.map((e) => e.content!);

        const contentFromComments = feedback.flatMap((c) => [
          c.message,
          ...c.images,
        ]);

        problem = [...contentFromElements, ...contentFromComments];
        elements = filteredElements;
        comments = [];

        await updateDesign({ id: currentDesign.id, problem });
      }

      sendRequest({
        id: uuidv4(),
        type: "generate_revision_agent_request",
        problem,
        elements: sanitizeElements(elements),
        comments,
      });

      await updateComments(
        ...feedback.map((c: Comment) => ({ id: c.id, is_submitted: true })),
      );
    } catch (error) {
      console.error("Error in handleDesignNextRev:", error);
    }
  }, [
    checkPaywall,
    currentDesign,
    feedback,
    layout.elements,
    sendRequest,
    updateComments,
    updateDesign,
  ]);

  useEffect(() => {
    if (!canTriggerGeneration) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        const el = e.target;
        if (
          el instanceof HTMLTextAreaElement ||
          el instanceof HTMLInputElement
        ) {
          if ((el.value?.trim() ?? "").length > 0) return;
        } else if (el instanceof HTMLElement && el.isContentEditable) {
          if ((el.textContent?.trim() ?? "").length > 0) return;
        }
        e.preventDefault();
        handleDesignNextRev();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canTriggerGeneration, handleDesignNextRev]);

  useEffect(() => {
    const handleModeKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        return;
      }

      if (e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }

      const key = e.key.toLowerCase();
      switch (key) {
        case "v":
          setMode("select");
          break;
        case "h":
          setMode("pan");
          break;
        case "c":
          setMode("comment");
          break;
        case "t":
          setMode("text");
          break;
      }
    };

    window.addEventListener("keydown", handleModeKeyDown);
    return () => window.removeEventListener("keydown", handleModeKeyDown);
  }, [setMode]);

  useEffect(() => {
    const handleClone = async () => {
      if (designId) {
        await cloneDesign(designId);
      }
    };

    handleClone();
  }, [designId, cloneDesign]);

  const initializedDesignRef = useRef<string | null>(null);
  const isGeneratingTitleRef = useRef(false);

  useEffect(() => {
    const initializeAndGenerate = async () => {
      if (!currentDesign || initializedDesignRef.current === currentDesign.id) {
        return;
      }

      if (layout.elements.length > 0) {
        initializedDesignRef.current = currentDesign.id;
        return;
      }

      if (agent.history.length > 0) {
        initializedDesignRef.current = currentDesign.id;
        return;
      }

      if (currentDesign.problem.length === 0) {
        initializedDesignRef.current = currentDesign.id;
        return;
      }

      initializedDesignRef.current = currentDesign.id;

      const userInputElements = createUserInputElements(currentDesign.problem);
      const placeholderElements = createInitialPlaceholderElements();
      await updateElements([...userInputElements, ...placeholderElements]);

      sendRequest({
        id: uuidv4().toString(),
        problem: currentDesign.problem,
        type: "generate_revision_agent_request",
      });

      sendRequest({
        id: uuidv4().toString(),
        problem: currentDesign.problem,
        type: "generate_user_input_title_agent_request",
      });
    };

    initializeAndGenerate();
  }, [
    currentDesign,
    layout.elements.length,
    agent.history.length,
    sendRequest,
    updateElements,
  ]);

  useEffect(() => {
    for (const item of agent.history) {
      if (item.type !== "error_agent_response") continue;
      const requestId = item.request_id;
      if (!requestId) continue;

      if (requestId in (agent.lastEventIdByRequestId ?? {})) continue;

      const originalRequest = agent.history.find(
        (h) =>
          (h.type === "generate_revision_agent_request" ||
            h.type === "retry_content_agent_request") &&
          h.id === requestId,
      );
      if (!originalRequest) continue;

      const hasSlots = agent.history.some(
        (h) =>
          (h.type === "generate_revision_agent_response" ||
            h.type === "retry_content_agent_response") &&
          h.request_id === requestId &&
          Object.keys(h.slots ?? {}).length > 0,
      );
      if (hasSlots) continue;

      const errorSlotId = `error-${requestId}`;
      if (layout.elements.some((e) => e.slot.id === errorSlotId)) continue;

      const placeholdersToDelete = layout.elements
        .filter(
          (e) =>
            INITIAL_PLACEHOLDER_IDS.includes(e.slot.id) &&
            e.content === undefined,
        )
        .map((e) => e.slot.id);

      if (placeholdersToDelete.length > 0) {
        deleteElements(placeholdersToDelete);
      }

      const remainingElements = layout.elements.filter(
        (e) => !placeholdersToDelete.includes(e.slot.id),
      );
      const baseY =
        remainingElements.length > 0
          ? Math.ceil(
              (Math.max(
                ...remainingElements.map((e) => e.slot.y + e.slot.height),
              ) +
                REVISION_GAP) /
                GRID_SIZE,
            ) * GRID_SIZE
          : 0;

      updateElements([
        {
          slot: {
            id: errorSlotId,
            x: 0,
            y: baseY,
            width: SLOT_WIDTH,
            height: IMAGE_HEIGHT,
            content_type: "image",
            description: { type: "text", text: "" },
            dependencies: [],
            source: "ai",
          },
          content: undefined,
          annotations: [],
        },
      ]);
    }
  }, [
    agent.history,
    agent.lastEventIdByRequestId,
    layout.elements,
    updateElements,
    deleteElements,
  ]);

  useEffect(() => {
    if (
      currentDesign &&
      !currentDesign.title &&
      !isGeneratingTitleRef.current
    ) {
      isGeneratingTitleRef.current = true;
      sendRequest({
        design_id: currentDesign.id,
        problem: currentDesign.problem,
        type: "generate_title_agent_request",
      });
    }
  }, [currentDesign, sendRequest]);

  useEffect(() => {
    if (loadingTimeoutRef.current) {
      window.clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }

    if (designId && !currentDesign) {
      loadingTimeoutRef.current = window.setTimeout(() => {
        setShowLoading(true);
      }, 100);
    } else {
      setShowLoading(false);
    }

    return () => {
      if (loadingTimeoutRef.current) {
        window.clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
    };
  }, [currentDesign, designId]);

  if (showLoading) {
    return (
      <div className="design-page-loading">
        <Loader2Icon className="design-page-loading-spinner" />
      </div>
    );
  }

  return (
    <div className="design-page">
      {/* Keep DesignPicker code for reference but don't render it */}
      {/* <DesignPicker isResponding={isResponding} /> */}
      <DesignPageHeader />

      <div ref={canvasContainerRef} className="design-page-canvas">
        <Canvas />
        <CommentsSidebar />
        <div className="design-page-floating-bar">
          {((showDesignSection && showDesigningInContainer) ||
            showSuccessToast ||
            showTimeoutBanner) && (
            <div
              ref={progressSectionRef}
              className={`design-page-progress-section${showSuccessToast ? " design-page-progress-section-success" : ""}${isExiting ? " design-page-progress-section-exit" : ""}`}
              onClick={showSuccessToast ? handleViewMocks : undefined}
              style={showSuccessToast ? { cursor: "pointer" } : undefined}
            >
              <div
                ref={contentWrapperRefCallback}
                className="design-page-progress-content"
              >
                {showSuccessToast ? (
                  <div className="design-page-success-content">
                    <span className="design-page-success-text">
                      Mocks successfully generated
                    </span>
                    <span className="design-page-success-view">View</span>
                    <span
                      className="design-page-success-close"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDismissToast();
                      }}
                    >
                      <XIcon size={16} />
                    </span>
                  </div>
                ) : showTimeoutBanner && !showDesignSection ? (
                  <div className="design-page-timeout-section">
                    <span className="design-page-timeout-text">
                      {confirmCancel ? (
                        <span
                          className="design-page-timeout-link"
                          onClick={handleTimeoutCancelClick}
                        >
                          Click again to confirm
                        </span>
                      ) : (
                        <>
                          Taking a while —{" "}
                          <span
                            className="design-page-timeout-link"
                            onClick={handleTimeoutCancelClick}
                          >
                            click to cancel
                          </span>
                        </>
                      )}
                    </span>
                  </div>
                ) : activeIterationCount > 1 ? (
                  <div className="design-page-multi-iteration">
                    <span className="design-page-multi-iteration-icon">
                      <PaintbrushIcon size={14} />
                    </span>
                    <span className="design-page-multi-iteration-text">
                      Working
                    </span>
                  </div>
                ) : (
                  (currentResponse?.type ===
                    "generate_revision_agent_response" ||
                    currentResponse?.type ===
                      "retry_content_agent_response") && (
                    <DesignSection
                      eventId={currentResponse.id ?? "unknown"}
                      slotsReasoning={
                        currentResponse.type ===
                        "generate_revision_agent_response"
                          ? currentResponse.slots_reasoning
                          : undefined
                      }
                      elementsReasoning={currentResponse.elements_reasoning}
                      isComplete={
                        !!(
                          currentResponse.slots &&
                          Object.keys(currentResponse.slots).length > 0 &&
                          currentResponse.elements &&
                          Object.keys(currentResponse.elements).length ===
                            Object.keys(currentResponse.slots).length
                        )
                      }
                      isResponding={isResponding}
                      requestStartTime={
                        currentRequest?.createdAt
                          ? new Date(currentRequest.createdAt).getTime()
                          : undefined
                      }
                    />
                  )
                )}
              </div>
            </div>
          )}
          <div className="design-page-design-button-container">
            <div className="design-page-main-button-section">
              {showFirstGenStates ? (
                (() => {
                  const canGenerate =
                    firstGenContent.hasText && firstGenContent.hasImage;
                  let buttonText = "Generate next iteration";
                  if (firstGenContent.hasText && !firstGenContent.hasImage) {
                    buttonText = "Add an image to generate mocks";
                  } else if (
                    firstGenContent.hasImage &&
                    !firstGenContent.hasText
                  ) {
                    buttonText = "Add text to generate mocks";
                  }
                  return (
                    <button
                      className={`design-page-design-button${canGenerate ? " design-page-design-button-active" : ""}`}
                      type="button"
                      disabled={!canGenerate}
                      onClick={handleDesignNextRev}
                    >
                      <SparklesIcon className="design-page-design-button-icon" />
                      <span className="design-page-design-button-text">
                        {buttonText}
                      </span>
                      {canGenerate && (
                        <span className="design-page-design-button-shortcut">
                          ⌘+Enter
                        </span>
                      )}
                    </button>
                  );
                })()
              ) : canSubmit ? (
                <button
                  className="design-page-design-button design-page-design-button-active"
                  type="button"
                  onClick={handleDesignNextRev}
                >
                  <SparklesIcon className="design-page-design-button-icon" />
                  <span className="design-page-design-button-text">
                    Generate next iteration
                  </span>
                  <span className="design-page-design-button-shortcut">
                    ⌘+Enter
                  </span>
                </button>
              ) : showDesigningInContainer ? (
                <div className="design-page-pending-design">
                  <PaintbrushIcon
                    size={18}
                    className="design-page-pending-icon"
                  />
                  <span className="design-page-pending-title">
                    {activeIterationCount > 1
                      ? `Designing ${activeIterationCount} iterations`
                      : "Designing (60-90s)"}
                  </span>
                  <button
                    className="design-page-stop-text"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCancelClick();
                    }}
                  >
                    {activeIterationCount > 1 ? "Stop all" : "Stop"}
                  </button>
                </div>
              ) : showSuccessToast ? (
                <div className="design-page-comment-prompt">
                  <ChatBubbleIcon
                    size={16}
                    className="design-page-comment-prompt-icon"
                  />
                  Comment for more mocks
                </div>
              ) : (
                <button
                  className="design-page-design-button"
                  type="button"
                  disabled
                >
                  <ChatBubbleIcon
                    size={16}
                    className="design-page-design-button-icon"
                  />
                  <span className="design-page-design-button-text">
                    Comment for more mocks
                  </span>
                </button>
              )}
            </div>
            <div className="design-page-mode-separator" />
            <div className="design-page-mode-selector">
              {MODE_BUTTONS.map((button) => (
                <button
                  key={button.mode}
                  className={`design-page-mode-button${mode === button.mode ? " design-page-mode-button-active" : ""}`}
                  onClick={() => setMode(button.mode)}
                  title={`${button.label} (${button.shortcut})`}
                  type="button"
                >
                  {button.icon}
                </button>
              ))}
            </div>
          </div>
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

export default DesignPage;
