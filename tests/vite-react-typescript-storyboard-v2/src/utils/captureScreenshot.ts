import type { ReactFlowInstance } from "reactflow";
import { toCanvas } from "html-to-image";

import type { ImageContent } from "../api/types.gen.ts";

const SCREENSHOT_WIDTH = 3440;
const SCREENSHOT_HEIGHT = 2240;

export async function captureScreenshot({
  reactFlowInstance: _reactFlowInstance,
  x,
  y,
}: {
  reactFlowInstance: ReactFlowInstance;
  x: number;
  y: number;
}): Promise<ImageContent | undefined> {
  try {
    const viewportElement = document.querySelector(".react-flow__viewport") as HTMLElement;
    if (!viewportElement) return undefined;

    const captureTransform = `translate(${SCREENSHOT_WIDTH / 2 - x}px, ${SCREENSHOT_HEIGHT / 2 - y}px) scale(1)`;

    const canvas = await toCanvas(viewportElement, {
      backgroundColor: "#ffffff",
      width: SCREENSHOT_WIDTH,
      height: SCREENSHOT_HEIGHT,
      style: {
        width: `${SCREENSHOT_WIDTH}px`,
        height: `${SCREENSHOT_HEIGHT}px`,
        transform: captureTransform,
      },
      skipFonts: true,
      pixelRatio: 1,
    });

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/webp", 0.6);
    });

    if (!blob) return undefined;

    const url = URL.createObjectURL(blob);
    return { type: "image", url };
  } catch (e) {
    console.error(e);
    return undefined;
  }
}
