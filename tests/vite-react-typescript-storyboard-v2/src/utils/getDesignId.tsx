import { validate } from "uuid";

export function getDesignId(pathname?: string): string | undefined {
  const segments = (pathname ?? window.location.pathname)
    .split("/")
    .filter(Boolean);

  const designId = segments[segments.length - 1];

  return validate(designId) ? designId : undefined;
}
