import { useAtom } from "jotai/react";
import { atom } from "jotai/vanilla";

export type CanvasMode = "select" | "pan" | "comment" | "text";

const canvasModeAtom = atom<CanvasMode>("comment");

const isSelectionBoxDraggingAtom = atom(false);

export function useCanvasMode() {
  const [mode, setMode] = useAtom(canvasModeAtom);
  const [isSelectionBoxDragging, setIsSelectionBoxDragging] = useAtom(
    isSelectionBoxDraggingAtom,
  );

  return { mode, setMode, isSelectionBoxDragging, setIsSelectionBoxDragging };
}
