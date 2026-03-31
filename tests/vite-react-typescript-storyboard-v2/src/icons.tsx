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

export const ChatBubbleIcon = createIcon(
  "ChatBubbleIcon",
  <path
    d="M4.80078 15.2949C4.19922 15.2949 3.83691 14.8848 3.83691 14.2217V12.6016H3.44043C1.49902 12.6016 0.248047 11.3848 0.248047 9.33398V3.98145C0.248047 1.93066 1.45117 0.707031 3.51562 0.707031H12.4775C14.5488 0.707031 15.752 1.93066 15.752 3.98145V9.33398C15.752 11.3779 14.5488 12.6016 12.4775 12.6016H8.38281L6.05176 14.6523C5.53906 15.1035 5.21777 15.2949 4.80078 15.2949ZM5.16992 13.5996L7.32324 11.4736C7.6377 11.1592 7.84277 11.0771 8.28027 11.0771H12.4092C13.6328 11.0771 14.2275 10.4619 14.2275 9.26562V4.0498C14.2275 2.84668 13.6328 2.23145 12.4092 2.23145H3.58398C2.36035 2.23145 1.77246 2.84668 1.77246 4.0498V9.26562C1.77246 10.4619 2.36035 11.0771 3.58398 11.0771H4.58203C4.97852 11.0771 5.16992 11.2412 5.16992 11.6719V13.5996Z"
    fill="currentColor"
  />,
  { viewBox: "0 0 16 16", stroke: "none", strokeWidth: 0 },
);

export const CheckIcon = createIcon(
  "CheckIcon",
  <path d="M20 6 9 17l-5-5" />,
);

export const ChevronDownIcon = createIcon(
  "ChevronDownIcon",
  <path d="m6 9 6 6 6-6" />,
);

export const CommentBubbleIcon = forwardRef<SVGSVGElement, IconProps>(
  ({ size, fill = "#F9F7F4", stroke = "#453321", ...props }, ref) => (
    <svg
      ref={ref}
      width={size ?? 28}
      height={size ? size : 27}
      viewBox="0 0 28 27"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path
        d="M20.8223 1C22.6088 1 24.1324 1.49773 25.2061 2.58008C26.2782 3.66101 26.7598 5.18203 26.7598 6.9375V15.1953C26.7597 16.9506 26.2781 18.4694 25.2051 19.5479C24.1309 20.6273 22.6072 21.1221 20.8223 21.1221H13.9229L10.3262 24.4082L10.3271 24.4092C9.82398 24.8802 9.25267 25.3691 8.40332 25.3691C7.83718 25.3691 7.30296 25.1545 6.92773 24.708C6.57152 24.2841 6.44434 23.754 6.44434 23.2588V21.1074C4.87324 21.0235 3.5301 20.5303 2.55566 19.5527C1.48147 18.475 1.00004 16.9554 1 15.1953V6.9375L1.00586 6.61035C1.06265 4.98882 1.54849 3.58791 2.55469 2.5752C3.62904 1.49396 5.15259 1 6.9375 1H20.8223Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="2"
      />
    </svg>
  ),
);
CommentBubbleIcon.displayName = "CommentBubbleIcon";

export const CompassIcon = createIcon(
  "CompassIcon",
  <>
    <path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z" />
    <circle cx="12" cy="12" r="10" />
  </>,
);

export const CreditCardIcon = createIcon(
  "CreditCardIcon",
  <>
    <rect width="20" height="14" x="2" y="5" rx="2" />
    <line x1="2" x2="22" y1="10" y2="10" />
  </>,
);

export const GiftIcon = createIcon(
  "GiftIcon",
  <>
    <rect x="3" y="8" width="18" height="4" rx="1" />
    <path d="M12 8v13" />
    <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
    <path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5" />
  </>,
);

export const HandIcon = createIcon(
  "HandIcon",
  <>
    <path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2" />
    <path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2" />
    <path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8" />
    <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
  </>,
);

export const HomeIcon = createIcon(
  "HomeIcon",
  <>
    <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
    <path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
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

export const Loader2Icon = createIcon(
  "Loader2Icon",
  <path d="M21 12a9 9 0 1 1-6.219-8.56" />,
);

export const LocateIcon = createIcon(
  "LocateIcon",
  <>
    <line x1="2" x2="5" y1="12" y2="12" />
    <line x1="19" x2="22" y1="12" y2="12" />
    <line x1="12" x2="12" y1="2" y2="5" />
    <line x1="12" x2="12" y1="19" y2="22" />
    <circle cx="12" cy="12" r="7" />
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

export const MenuIcon = createIcon(
  "MenuIcon",
  <>
    <path d="M4 5h16" />
    <path d="M4 12h16" />
    <path d="M4 19h16" />
  </>,
);

export const MinusIcon = createIcon(
  "MinusIcon",
  <path d="M5 12h14" />,
);

export const MousePointer2Icon = createIcon(
  "MousePointer2Icon",
  <path d="M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z" />,
);

export const PaintbrushIcon = createIcon(
  "PaintbrushIcon",
  <>
    <path d="m14.622 17.897-10.68-2.913" />
    <path d="M18.376 2.622a1 1 0 1 1 3.002 3.002L17.36 9.643a.5.5 0 0 0 0 .707l.944.944a2.41 2.41 0 0 1 0 3.408l-.944.944a.5.5 0 0 1-.707 0L8.354 7.348a.5.5 0 0 1 0-.707l.944-.944a2.41 2.41 0 0 1 3.408 0l.944.944a.5.5 0 0 0 .707 0z" />
    <path d="M9 8c-1.804 2.71-3.97 3.46-6.583 3.948a.507.507 0 0 0-.302.819l7.32 8.883a1 1 0 0 0 1.185.204C12.735 20.405 16 16.792 16 15" />
  </>,
);

export const PaletteIcon = createIcon(
  "PaletteIcon",
  <>
    <path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z" />
    <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
    <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
    <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
    <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
  </>,
);

export const PencilIcon = createIcon(
  "PencilIcon",
  <>
    <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
    <path d="m15 5 4 4" />
  </>,
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

export const SlidersHorizontalIcon = createIcon(
  "SlidersHorizontalIcon",
  <>
    <path d="M10 5H3" />
    <path d="M12 19H3" />
    <path d="M14 3v4" />
    <path d="M16 17v4" />
    <path d="M21 12h-9" />
    <path d="M21 19h-5" />
    <path d="M21 5h-7" />
    <path d="M8 10v4" />
    <path d="M8 12H3" />
  </>,
);

export const SparklesIcon = forwardRef<SVGSVGElement, IconProps>(
  ({ size, ...props }, ref) => (
    <svg
      ref={ref}
      width={size ?? 13}
      height={size ?? 16}
      viewBox="0 0 13 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M6.01562 3.39062C5.91309 3.39062 5.85156 3.32227 5.83789 3.22656C5.64648 2.11914 5.66016 2.08496 4.49121 1.87305C4.38184 1.85254 4.32031 1.79785 4.32031 1.69531C4.32031 1.59277 4.38184 1.53125 4.48438 1.51758C5.66699 1.29199 5.65332 1.25781 5.83789 0.170898C5.85156 0.0683594 5.91309 0 6.01562 0C6.11816 0 6.17969 0.0683594 6.19336 0.164062C6.38477 1.27832 6.37109 1.31934 7.54688 1.51758C7.64258 1.53125 7.71094 1.59277 7.71094 1.69531C7.71094 1.79785 7.64941 1.85254 7.54688 1.87305C6.37109 2.09863 6.38477 2.13281 6.19336 3.22656C6.17969 3.32227 6.11816 3.39062 6.01562 3.39062ZM2.7002 8.2168C2.5498 8.2168 2.43359 8.11426 2.41992 7.9502C2.20117 6.15234 2.12598 6.09766 0.280273 5.81055C0.102539 5.7832 0 5.6875 0 5.53027C0 5.37988 0.102539 5.27734 0.246094 5.25C2.11914 4.90137 2.20117 4.90137 2.41992 3.10352C2.43359 2.94629 2.5498 2.83691 2.7002 2.83691C2.85059 2.83691 2.95996 2.94629 2.97363 3.09668C3.21289 4.93555 3.26758 4.99023 5.14746 5.25C5.28418 5.27051 5.39355 5.37988 5.39355 5.53027C5.39355 5.68066 5.29102 5.7832 5.14746 5.81055C3.26074 6.15918 3.21289 6.16602 2.97363 7.9707C2.95996 8.11426 2.84375 8.2168 2.7002 8.2168ZM7.49902 15.8115C7.2666 15.8115 7.08203 15.6406 7.04102 15.4014C6.50098 11.7305 6.02246 11.2588 2.42676 10.7734C2.17383 10.7393 2.00293 10.5547 2.00293 10.3154C2.00293 10.0762 2.18066 9.88477 2.42676 9.85742C6.0293 9.4541 6.54883 8.90723 7.04102 5.23633C7.08203 4.99023 7.25977 4.81934 7.49902 4.81934C7.73145 4.81934 7.90918 4.99023 7.9502 5.23633C8.47656 8.90723 8.96875 9.42676 12.5645 9.85742C12.8174 9.8916 12.9951 10.0762 12.9951 10.3154C12.9951 10.5547 12.8174 10.7461 12.5645 10.7734C8.96191 11.1768 8.44238 11.7305 7.9502 15.4014C7.90918 15.6406 7.73145 15.8115 7.49902 15.8115Z"
        fill="currentColor"
      />
    </svg>
  ),
);
SparklesIcon.displayName = "SparklesIcon";

export const Trash2Icon = createIcon(
  "Trash2Icon",
  <>
    <path d="M10 11v6" />
    <path d="M14 11v6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M3 6h18" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </>,
);

export const TypeIcon = createIcon(
  "TypeIcon",
  <>
    <path d="M12 4v16" />
    <path d="M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2" />
    <path d="M9 20h6" />
  </>,
);

export const WorkflowIcon = createIcon(
  "WorkflowIcon",
  <>
    <rect width="8" height="8" x="3" y="3" rx="2" />
    <path d="M7 11v4a2 2 0 0 0 2 2h4" />
    <rect width="8" height="8" x="13" y="13" rx="2" />
  </>,
);

export const XIcon = createIcon(
  "XIcon",
  <>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </>,
);
