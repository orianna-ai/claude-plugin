import { GRID_SIZE } from "../api/layout.ts";

const VARIANT_METRICS: Record<
  "h1" | "h2" | "h3" | "p" | "small",
  { fontSize: number; lineHeight: number; avgCharWidth: number }
> = {
  h1: { fontSize: 96, lineHeight: 1.4, avgCharWidth: 41 },
  h2: { fontSize: 80, lineHeight: 1.4, avgCharWidth: 34 },
  h3: { fontSize: 64, lineHeight: 1.4, avgCharWidth: 27 },
  p: { fontSize: 40, lineHeight: 1.5, avgCharWidth: 17 },
  small: { fontSize: 28, lineHeight: 1.5, avgCharWidth: 12 },
};

function snapToGrid(value: number): number {
  return Math.ceil(value / GRID_SIZE) * GRID_SIZE;
}

export function calculateTextHeight(
  text: string,
  width: number,
  variant: "h1" | "h2" | "h3" | "p" | "small" = "p",
): number {
  const metrics = VARIANT_METRICS[variant];
  const lineHeightPx = metrics.fontSize * metrics.lineHeight;
  const charsPerLine = Math.max(1, Math.floor(width / metrics.avgCharWidth));
  const paragraphs = text.split("\n");
  let totalLines = 0;
  for (const paragraph of paragraphs) {
    if (paragraph.length === 0) {
      totalLines += 1;
    } else {
      totalLines += Math.ceil(paragraph.length / charsPerLine);
    }
  }
  const estimatedLines = Math.max(totalLines, 1) + 1;
  const rawHeight = estimatedLines * lineHeightPx;
  return snapToGrid(rawHeight);
}
