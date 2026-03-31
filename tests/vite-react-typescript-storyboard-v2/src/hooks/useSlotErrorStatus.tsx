import { useMemo } from "react";

import type { Agent } from "./useAgent";
import type {
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
  ErrorAgentResponse,
} from "../api/types.gen";

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

const ERROR_TIMEOUT_MS = 7 * 60 * 1000;

export type SlotErrorStatus =
  | "generation_failed"
  | "final_image_failed"
  | "timeout"
  | "hidden"
  | null;

function findRequestForSlot(
  slotId: string,
  history: (AgentRequest | AgentResponse)[],
): {
  requestId: string;
  response: GenerateRevisionAgentResponse | RetryContentAgentResponse;
} | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const item = history[i];
    if (
      item.type === "generate_revision_agent_response" ||
      item.type === "retry_content_agent_response"
    ) {
      const resp = item as
        | GenerateRevisionAgentResponse
        | RetryContentAgentResponse;
      const hasSlot = slotId in (resp.slots ?? {});
      const hasElement = slotId in (resp.elements ?? {});
      if (hasSlot || hasElement) {
        const requestId = resp.request_id;
        if (!requestId) {
          return null;
        }
        return { requestId, response: resp };
      }
    }
  }
  return null;
}

export function isPlanningFailure(
  response: GenerateRevisionAgentResponse | RetryContentAgentResponse,
): boolean {
  if (response.type === "retry_content_agent_response") {
    return false;
  }

  const slots = Object.values(response.slots ?? {});
  const imageSlots = slots.filter((slot) => slot.content_type === "image");

  if (imageSlots.length === 0) return false;

  return imageSlots.every(
    (slot) =>
      slot.description?.type === "text" && !slot.description.text?.trim(),
  );
}

function getFirstImageSlotId(
  response: GenerateRevisionAgentResponse | RetryContentAgentResponse,
): string | null {
  const slots = Object.values(response.slots ?? {});
  const imageSlots = slots.filter((slot) => slot.content_type === "image");

  if (imageSlots.length === 0) return null;

  imageSlots.sort((a, b) => a.id.localeCompare(b.id));

  return imageSlots[0].id;
}

export function getSlotErrorStatus(
  slotId: string,
  agent: Agent,
  now: number,
): SlotErrorStatus {
  if (slotId.startsWith("error-")) {
    const errorRequestId = slotId.slice("error-".length);
    const isActive = errorRequestId in (agent.lastEventIdByRequestId ?? {});
    return isActive ? null : "generation_failed";
  }

  const requestInfo = findRequestForSlot(slotId, agent.history);

  if (!requestInfo) {
    return null;
  }

  const { requestId, response } = requestInfo;

  const isRequestActive = requestId in (agent.lastEventIdByRequestId ?? {});

  const elementInResponse = response.elements?.[slotId];
  const content = elementInResponse?.content;
  const hasFinalImage = content?.type === "image" && !content.is_preview;
  const hasPreviewOnly = content?.type === "image" && content.is_preview;

  if (hasFinalImage) return null;

  if (!isRequestActive) {
    if (isPlanningFailure(response)) {
      const firstImageSlotId = getFirstImageSlotId(response);
      if (slotId !== firstImageSlotId) {
        return "hidden";
      }
    }

    if (hasPreviewOnly) return "final_image_failed";
    return "generation_failed";
  }

  const request = agent.history.find(
    (item) =>
      "created_at" in item &&
      item.id === requestId &&
      (item.type === "generate_revision_agent_request" ||
        item.type === "retry_content_agent_request"),
  ) as (AgentRequest & { created_at?: string }) | undefined;

  const createdAt = request?.created_at;
  const startTime = createdAt ? new Date(createdAt).getTime() : null;
  const isTimedOut = startTime && now - startTime > ERROR_TIMEOUT_MS;
  if (isTimedOut) return "timeout";

  return null;
}

export function useSlotErrorStatus(
  slotId: string,
  agent: Agent,
  now: number,
  isUserInput: boolean,
): SlotErrorStatus {
  return useMemo(() => {
    if (isUserInput) return null;
    return getSlotErrorStatus(slotId, agent, now);
  }, [slotId, agent, now, isUserInput]);
}
