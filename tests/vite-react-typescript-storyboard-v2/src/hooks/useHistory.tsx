import { useCallback, useEffect, useRef } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai/react";
import { atom } from "jotai/vanilla";

import type { ElementOutput } from "../api/types.gen";

import { type Layout, layoutAtom } from "./useLayout";

type Element = ElementOutput;

function isUserCreatedElement(el: Element): boolean {
  return el.slot.source === "user";
}

function isLoadingContent(content: Element["content"]): boolean {
  if (!content) return true;
  if (content.type === "text") {
    return content.text === "";
  }
  if (content.type === "image") {
    return !content.url;
  }
  return false;
}

function mergeWithCurrentContent(historical: Layout, current: Layout): Layout {
  const currentContentById = new Map(
    current.elements.map((e) => [e.slot.id, e.content]),
  );
  const historicalElementIds = new Set(
    historical.elements.map((e) => e.slot.id),
  );

  return {
    ...historical,
    elements: [
      ...historical.elements.map((el) => {
        if (isUserCreatedElement(el)) {
          return el;
        }
        const currentContent = currentContentById.get(el.slot.id);
        if (
          isLoadingContent(el.content) &&
          currentContent &&
          !isLoadingContent(currentContent)
        ) {
          return { ...el, content: currentContent };
        }
        return el;
      }),
      ...current.elements.filter(
        (el) =>
          !isUserCreatedElement(el) && !historicalElementIds.has(el.slot.id),
      ),
    ],
  };
}

const MAX_HISTORY = 50;

type HistoryState = {
  past: Layout[];
  future: Layout[];
};

const historyAtom = atom<HistoryState>({
  past: [],
  future: [],
});

let lastUndoTime = 0;
let lastRedoTime = 0;
const THROTTLE_MS = 150;

export function useHistory() {
  const [history, setHistory] = useAtom(historyAtom);
  const layout = useAtomValue(layoutAtom);
  const setLayout = useSetAtom(layoutAtom);

  const historyRef = useRef(history);
  historyRef.current = history;

  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  const commitBeforeChange = useCallback(() => {
    const currentLayout = layoutRef.current;
    const layoutToSave = currentLayout;

    setHistory((prev) => ({
      past: [...prev.past, layoutToSave].slice(-MAX_HISTORY),
      future: [],
    }));
  }, [setHistory]);

  const undo = useCallback(() => {
    const now = performance.now();

    if (now - lastUndoTime < THROTTLE_MS) {
      return;
    }
    lastUndoTime = now;

    const currentLayoutForFuture = layoutRef.current;

    let layoutToRestore: Layout | null = null;

    setHistory((prev) => {
      if (prev.past.length === 0) {
        return prev;
      }

      layoutToRestore = prev.past[prev.past.length - 1];

      return {
        past: prev.past.slice(0, -1),
        future: [currentLayoutForFuture, ...prev.future],
      };
    });

    if (layoutToRestore) {
      setLayout((currentLayout) => {
        return mergeWithCurrentContent(layoutToRestore!, currentLayout);
      });
    }
  }, [setHistory, setLayout]);

  const redo = useCallback(() => {
    const now = performance.now();

    if (now - lastRedoTime < THROTTLE_MS) {
      return;
    }
    lastRedoTime = now;

    const currentLayoutForPast = layoutRef.current;

    let layoutToRestore: Layout | null = null;

    setHistory((prev) => {
      if (prev.future.length === 0) {
        return prev;
      }

      layoutToRestore = prev.future[0];

      return {
        past: [...prev.past, currentLayoutForPast],
        future: prev.future.slice(1),
      };
    });

    if (layoutToRestore) {
      setLayout((currentLayout) => {
        return mergeWithCurrentContent(layoutToRestore!, currentLayout);
      });
    }
  }, [setHistory, setLayout]);

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (modifier && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (modifier && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
      } else if (modifier && e.key === "y") {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  return { commitBeforeChange, undo, redo, canUndo, canRedo };
}
