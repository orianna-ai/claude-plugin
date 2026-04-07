import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Reasoning } from "../../../api/types.gen";
import { MOCK_DELAY_MS } from "../../../constants/mockDelays";

import ReasoningMessage from "./ReasoningMessage";

import "./DesignSection.css";

type Props = {
  eventId: string;
  slotsReasoning?: Record<string, Reasoning>;
  elementsReasoning?: Record<string, Reasoning>;
  isComplete: boolean;
  isResponding: boolean;
  requestStartTime?: number;
};

const PLANNING_MIN_DISPLAY_MS = 3000;

function DesignSection({
  eventId,
  slotsReasoning,
  elementsReasoning,
  isComplete: _isComplete,
  isResponding: _isResponding,
  requestStartTime: _requestStartTime,
}: Props) {
  const slotsEntries = useMemo<[string, Reasoning][]>(
    () => Object.entries(slotsReasoning ?? {}),
    [slotsReasoning],
  );

  const elementsEntries = useMemo<[string, Reasoning][]>(
    () => Object.entries(elementsReasoning ?? {}),
    [elementsReasoning],
  );

  const _hasIncompletePlanning = useMemo(
    () => slotsEntries.some(([, r]) => !r.completed_at),
    [slotsEntries],
  );

  const allMockingComplete = useMemo(() => {
    if (elementsEntries.length === 0) return false;
    return elementsEntries.every(([, r]) => r.completed_at);
  }, [elementsEntries]);

  const firstSummaryTimeRef = useRef<number | null>(null);
  const [canShowMocking, setCanShowMocking] = useState(false);

  const hasPlaningSummaries = useMemo(
    () =>
      slotsEntries.some(([, r]) => Object.keys(r.summaries ?? {}).length > 0),
    [slotsEntries],
  );

  useEffect(() => {
    if (hasPlaningSummaries && firstSummaryTimeRef.current === null) {
      firstSummaryTimeRef.current = Date.now();
      const timer = setTimeout(() => {
        setCanShowMocking(true);
      }, PLANNING_MIN_DISPLAY_MS);
      return () => clearTimeout(timer);
    }
  }, [hasPlaningSummaries]);

  useEffect(() => {
    firstSummaryTimeRef.current = null;
    setCanShowMocking(false);
  }, [eventId]);

  const shouldShowMocking = useMemo(() => {
    if (elementsEntries.length === 0) return false;
    if (!hasPlaningSummaries) return true;
    return canShowMocking;
  }, [elementsEntries.length, hasPlaningSummaries, canShowMocking]);

  const [displayedState, setDisplayedState] = useState<"planning" | "mocking">(
    "planning",
  );
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (shouldShowMocking && displayedState === "planning") {
      setIsTransitioning(true);

      const timer = setTimeout(() => {
        setDisplayedState("mocking");
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setIsTransitioning(false);
          });
        });
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [shouldShowMocking, displayedState]);

  useEffect(() => {
    setDisplayedState("planning");
    setIsTransitioning(false);
  }, [eventId]);

  const allEntries = useMemo(() => {
    if (displayedState === "mocking") {
      if (allMockingComplete) {
        return [];
      }
      return [
        [
          "__mocking__",
          {
            summaries: {},
            created_at: elementsEntries[0]?.[1]?.created_at,
            completed_at: undefined,
          } as Reasoning,
        ] as [string, Reasoning],
      ];
    }

    return [...slotsEntries];
  }, [slotsEntries, elementsEntries, allMockingComplete, displayedState]);

  const [now, setNow] = useState(Date.now());

  const isReasoningDelayed = useCallback(
    (reasoning: Reasoning | undefined) => {
      if (!reasoning || reasoning.completed_at) return false;
      if (!reasoning.created_at) return false;
      const created = new Date(reasoning.created_at).getTime();
      return now - created > MOCK_DELAY_MS;
    },
    [now],
  );

  const hasActiveReasoning = useMemo(
    () =>
      slotsEntries.some(([_, r]) => !r.completed_at) ||
      elementsEntries.some(
        ([_, r]) => !r.completed_at && !isReasoningDelayed(r),
      ),
    [slotsEntries, elementsEntries, isReasoningDelayed],
  );

  useEffect(() => {
    if (!hasActiveReasoning) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [hasActiveReasoning]);

  const bodyInnerRef = useRef<HTMLDivElement | null>(null);
  const lastCountRef = useRef<number>(0);

  useEffect(() => {
    const currentCount = allEntries.length;
    const prevCount = lastCountRef.current;
    lastCountRef.current = currentCount;

    if (currentCount > prevCount && bodyInnerRef.current) {
      const container = bodyInnerRef.current;
      const lastChild = container.lastElementChild as HTMLElement | null;
      requestAnimationFrame(() => {
        if (lastChild) {
          container.scrollTo({
            top: lastChild.offsetTop,
            behavior: "smooth",
          });
        }
      });
    }
  }, [allEntries]);

  if (allEntries.length === 0) {
    return null;
  }

  const showingMocking = displayedState === "mocking" && !allMockingComplete;

  return (
    <div
      className={`design-section${isTransitioning ? " design-section-transitioning" : ""}`}
      ref={bodyInnerRef}
    >
      {allEntries.map(([id, reasoning], index) => {
        const isMockingPlaceholder =
          id === "__mocking__" || id === "__mocking-placeholder__";
        const isPlanning = !showingMocking && !isMockingPlaceholder;
        const isFirstPlanning = isPlanning && index === 0;

        const shouldAutoOpen = isMockingPlaceholder
          ? false
          : isPlanning && isFirstPlanning;

        const hasSummaries = Object.keys(reasoning.summaries ?? {}).length > 0;
        const shouldHideChevron = isMockingPlaceholder || !hasSummaries;

        const delayed = isReasoningDelayed(reasoning);

        const shouldAnimateItem = !reasoning.completed_at && !delayed;

        return (
          <div
            key={`${eventId}-reasoning-${id}`}
            className={`design-section-item${shouldAnimateItem ? " design-section-item-animate" : ""}`}
          >
            <ReasoningMessage
              reasoning={reasoning}
              variant={isMockingPlaceholder ? "design" : "default"}
              autoOpen={shouldAutoOpen}
              autoCloseOnComplete={false}
              disableInteraction={shouldHideChevron}
              hideChevron={shouldHideChevron}
              isDelayed={delayed}
            />
          </div>
        );
      })}
    </div>
  );
}

export default DesignSection;
