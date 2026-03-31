import {
  createContext,
  FC,
  MutableRefObject,
  ReactNode,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { useStore } from "reactflow";

type SavedPosition = {
  x: number;
  y: number;
  protectedUntil: number;
};

type CanvasContextValue = {
  tx: number;
  ty: number;
  zoom: number;
  selectedCommentId: string | null;
  setSelectedCommentId: (id: string | null) => void;
  currentlyEditingNodeId: string | null;
  setCurrentlyEditingNodeId: (id: string | null) => void;
  // Saved positions ref for protecting node positions during drag/resize
  savedPositionsRef: MutableRefObject<Map<string, SavedPosition>>;
  // Helper to save a node position with protection window (for resize)
  saveNodePosition: (nodeId: string, x: number, y: number) => void;
  // Track if nodes are being moved via pan-while-drag (for hiding toolbars)
  isPanDragging: boolean;
  setIsPanDragging: (value: boolean) => void;
  // Track hovered/selected group node for showing bounding box
  activeGroupNodeId: string | null;
  setActiveGroupNodeId: (id: string | null) => void;
  // Track if the active group node is in chat mode (for styling the bounding box)
  activeGroupNodeChatMode: boolean;
  setActiveGroupNodeChatMode: (isChatMode: boolean) => void;
};

const CanvasContext = createContext<CanvasContextValue | null>(null);

export const CanvasContextProvider: FC<{ children: ReactNode }> = ({
  children,
}) => {
  // Subscribe to transform values once at the canvas level
  // All comments will read from context instead of creating their own subscriptions
  const tx = useStore((s) => s.transform[0]);
  const ty = useStore((s) => s.transform[1]);
  const zoom = useStore((s) => s.transform[2]);

  // Local state for which comment is selected/open
  // This is intentionally NOT persisted - each user has their own selection
  const [selectedCommentId, setSelectedCommentIdState] = useState<
    string | null
  >(null);

  const setSelectedCommentId = useCallback((id: string | null) => {
    setSelectedCommentIdState(id);
  }, []);

  // Track which TextNode is currently in edit mode
  // When clicking outside while editing, we exit edit mode and deselect the node
  // This is set when ENTERING edit mode, cleared when EXITING
  const [currentlyEditingNodeId, setCurrentlyEditingNodeIdState] = useState<
    string | null
  >(null);

  const setCurrentlyEditingNodeId = useCallback((id: string | null) => {
    setCurrentlyEditingNodeIdState(id);
  }, []);

  // Saved positions ref for protecting node positions during drag/resize
  // This prevents stale SSE/layout updates from snapping nodes back
  const savedPositionsRef = useRef<Map<string, SavedPosition>>(new Map());

  // Track if nodes are being moved via pan-while-drag (click-hold + pan)
  // This is used to hide toolbars during pan-drag, similar to how ReactFlow's
  // dragging prop hides toolbars during normal drag
  const [isPanDragging, setIsPanDragging] = useState(false);

  // Track hovered/selected group node for showing bounding box
  const [activeGroupNodeId, setActiveGroupNodeId] = useState<string | null>(
    null,
  );

  // Track if the active group node is in chat mode (for styling the bounding box)
  const [activeGroupNodeChatMode, setActiveGroupNodeChatMode] = useState(false);

  // Helper to save a node position with a 1 second protection window
  const saveNodePosition = useCallback(
    (nodeId: string, x: number, y: number) => {
      const protectedUntil = Date.now() + 1000; // 1 second protection window
      savedPositionsRef.current.set(nodeId, { x, y, protectedUntil });

      // Clean up after the protection window expires
      setTimeout(() => {
        const now = Date.now();
        const saved = savedPositionsRef.current.get(nodeId);
        if (saved && now > saved.protectedUntil) {
          savedPositionsRef.current.delete(nodeId);
        }
      }, 1500);
    },
    [],
  );

  return (
    <CanvasContext.Provider
      value={{
        tx,
        ty,
        zoom,
        selectedCommentId,
        setSelectedCommentId,
        currentlyEditingNodeId,
        setCurrentlyEditingNodeId,
        savedPositionsRef,
        saveNodePosition,
        isPanDragging,
        setIsPanDragging,
        activeGroupNodeId,
        setActiveGroupNodeId,
        activeGroupNodeChatMode,
        setActiveGroupNodeChatMode,
      }}
    >
      {children}
    </CanvasContext.Provider>
  );
};

export function useCanvasContext(): CanvasContextValue {
  const context = useContext(CanvasContext);
  if (!context) {
    throw new Error(
      "useCanvasContext must be used within CanvasContextProvider",
    );
  }
  return context;
}
