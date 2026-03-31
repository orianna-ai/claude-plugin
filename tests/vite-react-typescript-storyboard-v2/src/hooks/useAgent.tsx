import { useCallback, useMemo, useRef } from "react";
import { useAtom } from "jotai/react";

import type {
  Comment,
  ErrorAgentResponse,
  GenerateRevisionAgentRequestOutput,
  GenerateRevisionAgentResponse,
  GenerateTitleAgentRequest,
  GenerateTitleAgentResponse,
  GenerateUserInputTitleAgentRequest,
  GenerateUserInputTitleAgentResponse,
  GenerateCommentReplyAgentRequestOutput,
  GenerateCommentReplyAgentResponse,
  RetryContentAgentRequestOutput,
  RetryContentAgentResponse,
  ElementOutput,
  Slot,
  Reasoning,
} from "../api/types.gen.ts";
import {
  SLOT_WIDTH,
  SLOT_STRIDE,
  TITLE_HEIGHT,
  TITLE_TO_DESC_GAP,
  DESCRIPTION_HEIGHT,
  DESC_TO_CONTENT_GAP,
  IMAGE_HEIGHT,
  IMAGE_TO_CAPTION_GAP,
  IMAGE_CAPTION_HEIGHT,
  REVISION_GAP,
} from "../api/layout.ts";
import { createAtom } from "../utils/createAtom.tsx";

import { useDesigns } from "./useDesigns.tsx";
import { useLayout } from "./useLayout.tsx";

type AgentRequest =
  | GenerateRevisionAgentRequestOutput
  | GenerateTitleAgentRequest
  | GenerateUserInputTitleAgentRequest
  | GenerateCommentReplyAgentRequestOutput
  | RetryContentAgentRequestOutput;

type AgentResponse =
  | ErrorAgentResponse
  | GenerateRevisionAgentResponse
  | GenerateTitleAgentResponse
  | GenerateUserInputTitleAgentResponse
  | GenerateCommentReplyAgentResponse
  | RetryContentAgentResponse;

export type RequestComments = {
  submittable: Comment[];
  previouslySubmitted: Comment[];
  all: Comment[];
};

export type Agent = {
  history: (AgentRequest | AgentResponse)[];
  lastEventIdByRequestId?: Record<string, string>;
};

const agentAtom = createAtom<Agent>({
  name: "agent",
  initialValue: { history: [], lastEventIdByRequestId: {} },
  scope: "design",
});

const SAMPLE_IMAGES = [
  "https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=800&h=500&fit=crop",
  "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=500&fit=crop",
  "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=500&fit=crop",
  "https://images.unsplash.com/photo-1611339555312-e607c8352fd7?w=800&h=500&fit=crop",
  "https://linear.app/static/release/themes/dawn.png",
  "https://rankbreeze.com/wp-content/uploads/2023/09/Insights-Main-Page.png",
];

const MOCK_TITLES = [
  "Dashboard Exploration",
  "Onboarding Flow",
  "Settings Redesign",
  "Data Visualization Concepts",
  "Navigation Patterns",
];

const MOCK_DESCRIPTIONS = [
  "Three distinct approaches to the dashboard layout, each emphasizing different user priorities: quick actions, data overview, and recent activity.",
  "Exploring different navigation paradigms for the main interface, focusing on discoverability and reduced cognitive load.",
  "Visual concepts showing alternative ways to present complex data, with progressive disclosure and contextual detail views.",
];

const MOCK_CAPTIONS = [
  "Clean card-based layout with clear hierarchy. Key metrics are front and center with secondary actions below the fold.",
  "Dense information display optimized for power users. Uses compact typography and data tables for maximum information density.",
  "Visual-first approach using charts and graphs as primary navigation. Users click into data visualizations to drill down.",
  "Split-panel layout separating navigation from content. The left rail provides context while the main area shows details.",
  "Minimal interface with progressive disclosure. Information appears on hover or click, keeping the default view uncluttered.",
  "Tab-based organization grouping related features together. Each tab represents a distinct workflow or user goal.",
];

const COMMENT_REPLIES = [
  "Great observation! I've considered a few approaches here. The card layout works well for quick scanning, but we could also explore a list view for users who prefer density. What's the primary use case you're designing for?",
  "That's a valid concern. The spacing between elements is intentional — it helps reduce cognitive load when scanning. However, we could tighten it for power users with a compact mode toggle.",
  "Good point about the color usage. I'd suggest using the accent color sparingly for CTAs and important status indicators. The neutral palette keeps the focus on the content itself.",
  "I agree this could be improved. One approach is to use inline validation with immediate feedback rather than form-level error messages. This reduces frustration and helps users fix issues as they go.",
  "That's an interesting direction. We could implement a progressive onboarding flow where each step builds on the previous one, rather than showing everything at once. This reduces the initial learning curve.",
];

let revisionCounter = 0;

function createMockRevisionElements(revisionIndex: number): ElementOutput[] {
  const prefix = revisionIndex === 0 ? "" : `rev${revisionIndex}-`;
  const yOffset = revisionIndex === 0 ? 0 : revisionIndex * (TITLE_HEIGHT + TITLE_TO_DESC_GAP + DESCRIPTION_HEIGHT + DESC_TO_CONTENT_GAP + IMAGE_HEIGHT + IMAGE_TO_CAPTION_GAP + IMAGE_CAPTION_HEIGHT + REVISION_GAP);

  const titleY = yOffset;
  const descY = titleY + TITLE_HEIGHT + TITLE_TO_DESC_GAP;
  const imagesY = descY + DESCRIPTION_HEIGHT + DESC_TO_CONTENT_GAP;
  const captionsY = imagesY + IMAGE_HEIGHT + IMAGE_TO_CAPTION_GAP;

  const titleText = revisionIndex === 0
    ? MOCK_TITLES[Math.floor(Math.random() * MOCK_TITLES.length)]
    : `Revision ${revisionIndex + 1}`;

  const descText = MOCK_DESCRIPTIONS[Math.floor(Math.random() * MOCK_DESCRIPTIONS.length)];

  const elements: ElementOutput[] = [];

  elements.push({
    slot: {
      id: `${prefix}title`,
      x: 0,
      y: titleY,
      width: SLOT_WIDTH,
      height: TITLE_HEIGHT,
      content_type: "text",
      description: { type: "text", text: titleText, variant: "h1", bold: true },
      dependencies: [],
      source: "ai",
    },
    content: { type: "text", text: titleText, variant: "h1", bold: true },
    annotations: [],
  });

  elements.push({
    slot: {
      id: `${prefix}desc`,
      x: 0,
      y: descY,
      width: SLOT_WIDTH,
      height: DESCRIPTION_HEIGHT,
      content_type: "text",
      description: { type: "text", text: descText },
      dependencies: [],
      source: "ai",
    },
    content: { type: "text", text: descText },
    annotations: [],
  });

  for (let i = 0; i < 3; i++) {
    const imgUrl = SAMPLE_IMAGES[(revisionIndex * 3 + i) % SAMPLE_IMAGES.length];
    const captionText = MOCK_CAPTIONS[(revisionIndex * 3 + i) % MOCK_CAPTIONS.length];

    elements.push({
      slot: {
        id: `${prefix}img-${i}`,
        x: i * SLOT_STRIDE,
        y: imagesY,
        width: SLOT_WIDTH,
        height: IMAGE_HEIGHT,
        content_type: "image",
        description: { type: "text", text: `Design concept ${i + 1}` },
        dependencies: [],
        source: "ai",
      },
      content: { type: "image", url: imgUrl },
      annotations: [],
    });

    elements.push({
      slot: {
        id: `${prefix}img-${i}-desc`,
        x: i * SLOT_STRIDE,
        y: captionsY,
        width: SLOT_WIDTH,
        height: IMAGE_CAPTION_HEIGHT,
        content_type: "text",
        description: { type: "text", text: captionText },
        dependencies: [],
        source: "ai",
      },
      content: { type: "text", text: captionText },
      annotations: [],
    });
  }

  return elements;
}

function createMockSlots(elements: ElementOutput[]): Record<string, Slot> {
  const slots: Record<string, Slot> = {};
  for (const el of elements) {
    slots[el.slot.id] = el.slot;
  }
  return slots;
}

function createMockElementsMap(elements: ElementOutput[]): Record<string, ElementOutput> {
  const map: Record<string, ElementOutput> = {};
  for (const el of elements) {
    map[el.slot.id] = el;
  }
  return map;
}

function createMockReasoning(title: string): Record<string, Reasoning> {
  const id = crypto.randomUUID();
  return {
    [id]: {
      id,
      created_at: new Date().toISOString(),
      completed_at: null,
      summaries: {
        0: `Analyzing the design problem and identifying key user needs...`,
        1: `${title}: Exploring layout patterns that balance information density with visual clarity.`,
        2: `Evaluating three distinct approaches based on the target audience and core use cases.`,
      },
    },
  };
}

export function useAgent() {
  const [agent, setAgent] = useAtom(agentAtom);
  const { updateElements, addComment, updateComments } = useLayout();
  const { updateDesign } = useDesigns();
  const timeoutsRef = useRef<number[]>([]);

  const clearPendingTimeouts = useCallback(() => {
    for (const t of timeoutsRef.current) clearTimeout(t);
    timeoutsRef.current = [];
  }, []);

  const schedule = useCallback((fn: () => void, ms: number) => {
    timeoutsRef.current.push(window.setTimeout(fn, ms));
  }, []);

  const sendRequest = useCallback(
    (request: AgentRequest) => {
      const requestId = request.id ?? crypto.randomUUID();
      const requestWithId = { ...request, id: requestId, created_at: new Date().toISOString() };

      setAgent((prev) => ({
        ...prev,
        history: [...prev.history, requestWithId],
        lastEventIdByRequestId: {
          ...(prev.lastEventIdByRequestId ?? {}),
          [requestId]: "",
        },
      }));

      if (request.type === "generate_revision_agent_request") {
        const revIdx = revisionCounter++;
        const mockElements = createMockRevisionElements(revIdx);
        const mockSlots = createMockSlots(mockElements);
        const mockElementsMap = createMockElementsMap(mockElements);

        // Phase 1: Send slots (planning) after 1s
        schedule(() => {
          const slotsResponse: GenerateRevisionAgentResponse = {
            id: `response-slots-${requestId}`,
            request_id: requestId,
            type: "generate_revision_agent_response",
            slots: mockSlots,
            slots_reasoning: createMockReasoning("Planning layout"),
            elements: {},
            elements_reasoning: {},
          };

          setAgent((prev) => ({
            ...prev,
            history: [...prev.history.filter(h => h.id !== slotsResponse.id), slotsResponse],
            lastEventIdByRequestId: {
              ...(prev.lastEventIdByRequestId ?? {}),
              [requestId]: "slots",
            },
          }));

          updateElements(
            Object.values(mockSlots).map((slot) => ({ slot, annotations: [] })),
            { preserveExistingPositions: false },
          );
        }, 1000);

        // Phase 2: Send elements (mocking) after 3s
        schedule(() => {
          const fullResponse: GenerateRevisionAgentResponse = {
            id: `response-${requestId}`,
            request_id: requestId,
            type: "generate_revision_agent_response",
            slots: mockSlots,
            slots_reasoning: createMockReasoning("Planning layout"),
            elements: mockElementsMap,
            elements_reasoning: createMockReasoning("Generating content"),
          };

          setAgent((prev) => ({
            ...prev,
            history: prev.history
              .filter(h => h.id !== `response-slots-${requestId}` && h.id !== fullResponse.id)
              .concat(fullResponse),
          }));

          updateElements(mockElements, { preserveExistingPositions: false });
        }, 3000);

        // Phase 3: Done
        schedule(() => {
          setAgent((prev) => {
            const { [requestId]: _, ...rest } = prev.lastEventIdByRequestId ?? {};
            return { ...prev, lastEventIdByRequestId: rest };
          });
        }, 3500);

      } else if (request.type === "retry_content_agent_request") {
        const revIdx = revisionCounter++;
        const mockElements = createMockRevisionElements(revIdx);

        schedule(() => {
          const response: RetryContentAgentResponse = {
            id: `response-${requestId}`,
            request_id: requestId,
            type: "retry_content_agent_response",
            slots: createMockSlots(mockElements),
            elements: createMockElementsMap(mockElements),
          };

          setAgent((prev) => ({
            ...prev,
            history: [...prev.history, response],
          }));

          updateElements(mockElements, { preserveExistingPositions: true });
        }, 2000);

        schedule(() => {
          setAgent((prev) => {
            const { [requestId]: _, ...rest } = prev.lastEventIdByRequestId ?? {};
            return { ...prev, lastEventIdByRequestId: rest };
          });
        }, 2500);

      } else if (request.type === "generate_title_agent_request") {
        const titleReq = request as GenerateTitleAgentRequest;
        const title = MOCK_TITLES[Math.floor(Math.random() * MOCK_TITLES.length)];

        schedule(() => {
          const response: GenerateTitleAgentResponse = {
            id: `response-${requestId}`,
            request_id: requestId,
            type: "generate_title_agent_response",
            design_id: titleReq.design_id,
            title,
          };

          setAgent((prev) => ({
            ...prev,
            history: [...prev.history, response],
          }));

          updateDesign({ id: titleReq.design_id, title });
        }, 800);

        schedule(() => {
          setAgent((prev) => {
            const { [requestId]: _, ...rest } = prev.lastEventIdByRequestId ?? {};
            return { ...prev, lastEventIdByRequestId: rest };
          });
        }, 1000);

      } else if (request.type === "generate_user_input_title_agent_request") {
        const title = MOCK_TITLES[Math.floor(Math.random() * MOCK_TITLES.length)];

        schedule(() => {
          const response: GenerateUserInputTitleAgentResponse = {
            id: `response-${requestId}`,
            request_id: requestId,
            type: "generate_user_input_title_agent_response",
            title,
          };

          setAgent((prev) => ({
            ...prev,
            history: [...prev.history, response],
          }));

          updateElements(
            [{
              slot: {
                id: "user-input-title",
                x: 0,
                y: 0,
                width: SLOT_WIDTH,
                height: TITLE_HEIGHT,
                content_type: "text",
                description: { type: "text", text: title, variant: "h1", bold: true },
                dependencies: [],
                source: "ai",
              },
              content: { type: "text", text: title, variant: "h1", bold: true },
              annotations: [],
            }],
            { preserveExistingPositions: true },
          );
        }, 600);

        schedule(() => {
          setAgent((prev) => {
            const { [requestId]: _, ...rest } = prev.lastEventIdByRequestId ?? {};
            return { ...prev, lastEventIdByRequestId: rest };
          });
        }, 800);

      } else if (request.type === "generate_comment_reply_agent_request") {
        const replyText = COMMENT_REPLIES[Math.floor(Math.random() * COMMENT_REPLIES.length)];
        const commentReq = request as GenerateCommentReplyAgentRequestOutput;
        const threadId = commentReq.comment_id;

        schedule(() => {
          const reply: Comment = {
            id: `reply-${requestId}`,
            thread_id: threadId,
            message: { type: "text", text: replyText },
            images: [],
            is_deleted: false,
            is_editable: false,
            is_submitted: true,
            is_read: false,
            source: "ai",
            created_by: { name: "Storyboard AI", email: "ai@orianna.ai" },
          };

          const response: GenerateCommentReplyAgentResponse = {
            id: `response-${requestId}`,
            request_id: requestId,
            type: "generate_comment_reply_agent_response",
            reply,
          };

          setAgent((prev) => ({
            ...prev,
            history: [...prev.history, response],
          }));

          addComment(reply);
          if (threadId) {
            updateComments({ id: threadId, is_read: false });
          }
        }, 1500);

        schedule(() => {
          setAgent((prev) => {
            const { [requestId]: _, ...rest } = prev.lastEventIdByRequestId ?? {};
            return { ...prev, lastEventIdByRequestId: rest };
          });
        }, 2000);

      } else {
        schedule(() => {
          const response: ErrorAgentResponse = {
            id: `error-response-${requestId}`,
            request_id: requestId,
            type: "error_agent_response",
            summary: "Unknown request type",
          };

          setAgent((prev) => ({
            ...prev,
            history: [...prev.history, response],
          }));
        }, 500);

        schedule(() => {
          setAgent((prev) => {
            const { [requestId]: _, ...rest } = prev.lastEventIdByRequestId ?? {};
            return { ...prev, lastEventIdByRequestId: rest };
          });
        }, 600);
      }
    },
    [setAgent, updateElements, addComment, updateComments, updateDesign, schedule],
  );

  const isResponding = useMemo(
    () => Object.keys(agent.lastEventIdByRequestId ?? {}).length > 0,
    [agent.lastEventIdByRequestId],
  );

  const activeIterationCount = useMemo(() => {
    const activeRequestIds = Object.keys(agent.lastEventIdByRequestId ?? {});
    return agent.history.filter(
      (item) =>
        item.id &&
        activeRequestIds.includes(item.id) &&
        (item.type === "generate_revision_agent_request" ||
          item.type === "retry_content_agent_request"),
    ).length;
  }, [agent.history, agent.lastEventIdByRequestId]);

  const currentRequest = useMemo(() => {
    const activeRequestIds = Object.keys(agent.lastEventIdByRequestId ?? {});
    if (activeRequestIds.length === 0) return null;

    const activeRequests = agent.history.filter(
      (item) =>
        "created_at" in item &&
        item.id &&
        activeRequestIds.includes(item.id) &&
        (item.type === "generate_revision_agent_request" ||
          item.type === "retry_content_agent_request" ||
          item.type === "generate_title_agent_request" ||
          item.type === "generate_user_input_title_agent_request"),
    ) as (AgentRequest & { id: string; created_at?: string })[];

    if (activeRequests.length === 0) return null;

    const mostRecent = activeRequests.reduce((latest, current) => {
      const latestTime = latest.created_at
        ? new Date(latest.created_at).getTime()
        : 0;
      const currentTime = current.created_at
        ? new Date(current.created_at).getTime()
        : 0;
      return currentTime > latestTime ? current : latest;
    });

    return {
      requestId: mostRecent.id,
      createdAt: mostRecent.created_at,
    };
  }, [agent.history, agent.lastEventIdByRequestId]);

  const cancelAllRequests = useCallback(() => {
    clearPendingTimeouts();
    setAgent((prev) => ({
      ...prev,
      lastEventIdByRequestId: {},
    }));
  }, [setAgent, clearPendingTimeouts]);

  const cancelRequest = useCallback(
    (requestId: string) => {
      setAgent((prev) => {
        const { [requestId]: _, ...rest } = prev.lastEventIdByRequestId ?? {};
        return { ...prev, lastEventIdByRequestId: rest };
      });
    },
    [setAgent],
  );

  const getCommentsForRequest = useCallback(
    (requestId: string): RequestComments | null => {
      const request = agent.history.find(
        (item) =>
          (item.type === "generate_revision_agent_request" ||
            item.type === "retry_content_agent_request") &&
          item.id === requestId,
      );

      if (
        !request ||
        (request.type !== "generate_revision_agent_request" &&
          request.type !== "retry_content_agent_request")
      ) {
        return null;
      }

      const req = request as
        | GenerateRevisionAgentRequestOutput
        | RetryContentAgentRequestOutput;
      const allComments = req.comments ?? [];

      const submittable = allComments.filter(
        (c) => !c.is_submitted && !c.is_editable,
      );
      const previouslySubmitted = allComments.filter((c) => c.is_submitted);

      return { submittable, previouslySubmitted, all: allComments };
    },
    [agent.history],
  );

  return {
    agent,
    isResponding,
    activeIterationCount,
    sendRequest,
    currentRequest,
    cancelAllRequests,
    cancelRequest,
    getCommentsForRequest,
  };
}
