import type {
  ElementOutput,
  ImageContent,
  TextContent,
} from "../api/types.gen.ts";
import {
  GRID_SIZE,
  IMAGE_HEIGHT,
  REVISION_GAP,
  SLOT_GAP,
  SLOT_WIDTH,
  TITLE_HEIGHT,
  TITLE_TO_DESC_GAP,
} from "../api/layout.ts";

import { calculateTextHeight } from "./calculateTextHeight.ts";

function snapToGrid(value: number): number {
  return Math.ceil(value / GRID_SIZE) * GRID_SIZE;
}

export function createUserInputElements(
  problem: (TextContent | ImageContent)[],
): ElementOutput[] {
  const textContent = problem.find((c) => c.type === "text") as
    | TextContent
    | undefined;
  const images = problem.filter((c) => c.type === "image") as ImageContent[];

  const textHeight = textContent
    ? snapToGrid(calculateTextHeight(textContent.text, SLOT_WIDTH))
    : 0;
  const imageRowHeight = images.length > 0 ? IMAGE_HEIGHT : 0;
  const rowHeight = Math.max(textHeight, imageRowHeight);

  const rowY = -(rowHeight + REVISION_GAP);

  const titleY = rowY - TITLE_TO_DESC_GAP - TITLE_HEIGHT;

  const elements: ElementOutput[] = [];

  elements.push({
    slot: {
      id: "user-input-title",
      x: 0,
      y: titleY,
      width: SLOT_WIDTH,
      height: TITLE_HEIGHT,
      content_type: "text",
      description: { type: "text", text: "", variant: "h1", bold: true },
      dependencies: [],
      source: "ai",
    },
    content: { type: "text", text: "", variant: "h1", bold: true },
    annotations: [],
  });

  if (textContent) {
    elements.push({
      slot: {
        id: "user-input-text",
        x: 0,
        y: rowY,
        width: SLOT_WIDTH,
        height: textHeight,
        content_type: "text",
        description: { type: "text", text: textContent.text },
        dependencies: [],
        source: "user",
      },
      content: textContent,
      annotations: [],
    });
  }

  images.forEach((img, i) => {
    elements.push({
      slot: {
        id: `user-input-img-${i}`,
        x: SLOT_WIDTH + SLOT_GAP + i * (SLOT_WIDTH + SLOT_GAP),
        y: rowY,
        width: SLOT_WIDTH,
        height: IMAGE_HEIGHT,
        content_type: "image",
        description: { type: "text", text: "" },
        dependencies: [],
        source: "user",
      },
      content: img,
      annotations: [],
    });
  });

  return elements;
}
