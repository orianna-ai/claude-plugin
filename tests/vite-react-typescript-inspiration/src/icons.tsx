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

export const ArrowRightIcon = createIcon(
  "ArrowRightIcon",
  <>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </>,
);

export const ArrowUpIcon = createIcon(
  "ArrowUpIcon",
  <>
    <path d="m5 12 7-7 7 7" />
    <path d="M12 19V5" />
  </>,
);

export const ImageIcon = createIcon(
  "ImageIcon",
  <>
    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
    <circle cx="9" cy="9" r="2" />
    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
  </>,
);

export const PlusIcon = createIcon(
  "PlusIcon",
  <>
    <path d="M5 12h14" />
    <path d="M12 5v14" />
  </>,
);

export const XIcon = createIcon(
  "XIcon",
  <>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </>,
);

export const LogOutIcon = createIcon(
  "LogOutIcon",
  <>
    <path d="m16 17 5-5-5-5" />
    <path d="M21 12H9" />
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
  </>,
);

export const Loader2Icon = createIcon(
  "Loader2Icon",
  <path d="M21 12a9 9 0 1 1-6.219-8.56" />,
);

export const ChevronDownIcon = createIcon(
  "ChevronDownIcon",
  <path d="m6 9 6 6 6-6" />,
);
