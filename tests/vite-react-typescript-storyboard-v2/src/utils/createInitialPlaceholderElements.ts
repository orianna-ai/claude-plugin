import type { ElementOutput } from "../api/types.gen.ts";
import {
  DESC_TO_CONTENT_GAP,
  DESCRIPTION_HEIGHT,
  IMAGE_CAPTION_HEIGHT,
  IMAGE_HEIGHT,
  IMAGE_TO_CAPTION_GAP,
  SLOT_STRIDE,
  SLOT_WIDTH,
  TITLE_HEIGHT,
  TITLE_TO_DESC_GAP,
} from "../api/layout.ts";

export function createInitialPlaceholderElements(): ElementOutput[] {
  const elements: ElementOutput[] = [];

  elements.push({
    slot: {
      id: "title",
      x: 0,
      y: 0,
      width: SLOT_WIDTH,
      height: TITLE_HEIGHT,
      content_type: "text",
      description: { type: "text", text: "", variant: "h1" },
      dependencies: [],
      source: "ai",
    },
    content: undefined,
    annotations: [],
  });

  const descY = TITLE_HEIGHT + TITLE_TO_DESC_GAP;
  elements.push({
    slot: {
      id: "desc",
      x: 0,
      y: descY,
      width: SLOT_WIDTH,
      height: DESCRIPTION_HEIGHT,
      content_type: "text",
      description: { type: "text", text: "" },
      dependencies: [],
      source: "ai",
    },
    content: undefined,
    annotations: [],
  });

  const imagesY = descY + DESCRIPTION_HEIGHT + DESC_TO_CONTENT_GAP;
  const captionsY = imagesY + IMAGE_HEIGHT + IMAGE_TO_CAPTION_GAP;

  for (let i = 0; i < 3; i++) {
    const x = i * SLOT_STRIDE;
    const imgId = `img-${i}`;

    elements.push({
      slot: {
        id: imgId,
        x,
        y: imagesY,
        width: SLOT_WIDTH,
        height: IMAGE_HEIGHT,
        content_type: "image",
        description: { type: "text", text: "" },
        dependencies: [],
        source: "ai",
      },
      content: undefined,
      annotations: [],
    });

    elements.push({
      slot: {
        id: `${imgId}-desc`,
        x,
        y: captionsY,
        width: SLOT_WIDTH,
        height: IMAGE_CAPTION_HEIGHT,
        content_type: "text",
        description: { type: "text", text: "" },
        dependencies: [],
        source: "ai",
      },
      content: undefined,
      annotations: [],
    });
  }

  return elements;
}
