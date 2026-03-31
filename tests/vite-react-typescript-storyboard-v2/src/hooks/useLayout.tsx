import { useCallback, useMemo, useRef } from "react";
import { atom } from "jotai";
import { useAtom } from "jotai/react";

import type { Comment, ElementOutput } from "../api/types.gen";
import { commentCreated } from "../telemetry";
import { createAtom } from "../utils/createAtom";

import { useDesigns } from "./useDesigns";

export type Element = ElementOutput;

export type Layout = {
  /** Elements that are displayed in the layout. */
  elements: Readonly<Element[]>;
  /** Comments that are displayed in the layout. */
  comments: Readonly<Comment[]>;
};

export const layoutAtom = createAtom<Layout>({
  initialValue: { elements: [], comments: [] },
  name: "layout",
  scope: "design",
});

const draftCommentAtom = atom<Comment | null>(null);

export function useLayout() {
  const [layout, setLayout] = useAtom(layoutAtom);
  const [draftComment, setDraftComment] = useAtom(draftCommentAtom);

  const draftCommentRef = useRef<Comment | null>(draftComment);
  draftCommentRef.current = draftComment;

  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  const { currentDesign } = useDesigns();

  const layoutWithDraft = useMemo((): Layout => {
    if (!draftComment) {
      return layout;
    }
    return {
      ...layout,
      comments: [...layout.comments, draftComment],
    };
  }, [layout, draftComment]);

  const updateElements = useCallback(
    async (
      elements: Element[],
      options?: { preserveExistingPositions?: boolean },
    ) => {
      const preservePositions = options?.preserveExistingPositions ?? true;

      await setLayout((prev) => {
        const existingById = new Map<string, Element>(
          prev.elements.map((e) => [e.slot.id, e]),
        );

        const elementsById = new Map<string, Element>();

        for (const element of prev.elements) {
          elementsById.set(element.slot.id, element);
        }

        for (const element of elements) {
          const existing = existingById.get(element.slot.id);

          if (existing && preservePositions) {
            elementsById.set(element.slot.id, {
              ...element,
              slot: {
                ...element.slot,
                x: existing.slot.x,
                y: existing.slot.y,
              },
            });
          } else {
            elementsById.set(element.slot.id, element);
          }
        }

        const newElements = Array.from(elementsById.values());
        return { ...prev, elements: newElements };
      });
    },
    [setLayout],
  );

  const createComment = useCallback(
    (comment: Comment) => {
      commentCreated.add(1, {
        design_id: currentDesign?.id,
        created_by: comment.created_by?.email,
      });

      draftCommentRef.current = comment;
      setDraftComment(comment);
    },
    [setDraftComment, currentDesign],
  );

  const updateComments = useCallback(
    async (...updates: (Partial<Comment> & { id: string })[]) => {
      const updatesById = new Map<string, Partial<Comment> & { id: string }>();
      for (const update of updates) {
        updatesById.set(update.id, update);
      }

      const currentDraft = draftCommentRef.current;

      if (currentDraft && updatesById.has(currentDraft.id)) {
        const draftUpdate = updatesById.get(currentDraft.id)!;
        const updatedDraft = { ...currentDraft, ...draftUpdate };

        if (!updatedDraft.is_editable) {
          await setLayout((prev) => ({
            ...prev,
            comments: [...prev.comments, updatedDraft],
          }));
          draftCommentRef.current = null;
          setDraftComment(null);
        } else {
          draftCommentRef.current = updatedDraft;
          setDraftComment(updatedDraft);
        }

        updatesById.delete(currentDraft.id);
      }

      if (updatesById.size > 0) {
        await setLayout((prev) => ({
          ...prev,
          comments: prev.comments.map((comment) =>
            updatesById.has(comment.id)
              ? { ...comment, ...updatesById.get(comment.id) }
              : comment,
          ),
        }));
      }
    },
    [setDraftComment, setLayout],
  );

  const deleteElements = useCallback(
    async (elementIds: string[]) => {
      const idsToDelete = new Set(elementIds);
      await setLayout((prev) => ({
        ...prev,
        elements: prev.elements.filter(
          (element) => !idsToDelete.has(element.slot.id),
        ),
      }));
    },
    [setLayout],
  );

  const addComment = useCallback(
    async (comment: Comment) => {
      if (layoutRef.current.comments.some((c) => c.id === comment.id)) {
        return;
      }

      await setLayout((prev) => {
        if (prev.comments.some((c) => c.id === comment.id)) {
          return prev;
        }
        return {
          ...prev,
          comments: [...prev.comments, comment],
        };
      });
    },
    [setLayout],
  );

  const getThreads = useCallback((): Map<string, Comment[]> => {
    const threads = new Map<string, Comment[]>();
    for (const comment of layoutWithDraft.comments) {
      if (comment.is_deleted) continue;

      const threadId = comment.thread_id ?? comment.id;
      const existing = threads.get(threadId) ?? [];
      threads.set(threadId, [...existing, comment]);
    }
    return threads;
  }, [layoutWithDraft.comments]);

  return {
    layout: layoutWithDraft,
    addComment,
    createComment,
    deleteElements,
    getThreads,
    updateElements,
    updateComments,
  };
}
