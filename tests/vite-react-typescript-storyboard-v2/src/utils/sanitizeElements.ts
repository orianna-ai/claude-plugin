import type { ElementOutput } from "../api/types.gen.ts";

export function sanitizeElements(elements: ElementOutput[]): ElementOutput[] {
  return elements.filter(
    (element) => element.slot.height > 0 && element.slot.width > 0,
  );
}
