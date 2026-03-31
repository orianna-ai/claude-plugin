import { forwardRef, type SVGProps } from "react";

interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

function createIcon(
  name: string,
  children: React.ReactNode,
  defaults?: Omit<IconProps, "size">,
) {
  const Icon = forwardRef<SVGSVGElement, IconProps>(
    ({ size = 24, ...props }, ref) => (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        {...defaults}
        {...props}
      >
        {children}
      </svg>
    ),
  );
  Icon.displayName = name;
  return Icon;
}

export const AlertCircleIcon = createIcon(
  "AlertCircleIcon",
  <>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" x2="12" y1="8" y2="12" />
    <line x1="12" x2="12.01" y1="16" y2="16" />
  </>,
);

export const CheckIcon = createIcon(
  "CheckIcon",
  <path d="M20 6 9 17l-5-5" />,
);

export const Loader2Icon = createIcon(
  "Loader2Icon",
  <path d="M21 12a9 9 0 1 1-6.219-8.56" />,
);

export const PlusIcon = createIcon(
  "PlusIcon",
  <>
    <path d="M5 12h14" />
    <path d="M12 5v14" />
  </>,
);

export const RefreshCwIcon = createIcon(
  "RefreshCwIcon",
  <>
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M8 16H3v5" />
  </>,
);

export const SaveIcon = createIcon(
  "SaveIcon",
  <>
    <path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
    <path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" />
    <path d="M7 3v4a1 1 0 0 0 1 1h7" />
  </>,
);

export const Trash2Icon = createIcon(
  "Trash2Icon",
  <>
    <path d="M3 6h18" />
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    <line x1="10" x2="10" y1="11" y2="17" />
    <line x1="14" x2="14" y1="11" y2="17" />
  </>,
);

export const UploadIcon = createIcon(
  "UploadIcon",
  <>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" x2="12" y1="3" y2="15" />
  </>,
);

export const XIcon = createIcon(
  "XIcon",
  <>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </>,
);
