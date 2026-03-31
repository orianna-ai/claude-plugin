import { FC, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { CheckIcon, ChevronDownIcon } from "../../../icons";
import type { TextContent } from "../../../api/types.gen";

import "./TextNodeToolbar.css";

type TextVariant = NonNullable<TextContent["variant"]>;

const VARIANT_LABELS: Record<TextVariant, string> = {
  small: "Small",
  p: "Medium",
  h3: "Large",
  h2: "Extra large",
  h1: "Huge",
};

const VARIANT_ORDER: TextVariant[] = ["small", "p", "h3", "h2", "h1"];

interface TextNodeToolbarProps {
  variant: TextVariant;
  bold: boolean;
  position: { x: number; y: number };
  onVariantChange: (variant: TextVariant) => void;
  onBoldChange: (bold: boolean) => void;
}

const TextNodeToolbar: FC<TextNodeToolbarProps> = ({
  variant,
  bold,
  position,
  onVariantChange,
  onBoldChange,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [hoveredElement, setHoveredElement] = useState<string | null>(null);

  const toolbarRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const boldRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownItemRefs = useRef<Map<TextVariant, HTMLButtonElement>>(
    new Map(),
  );

  // animate in on mount
  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));
  }, []);

  // detect clicks manually since toolbar has pointer-events: none
  // this allows wheel/scroll/pinch to pass through to the canvas
  useEffect(() => {
    // Track if mousedown started in toolbar to prevent drag-release triggering actions
    let mouseDownInToolbar = false;

    const isPointInRect = (
      x: number,
      y: number,
      rect: DOMRect | undefined,
    ): boolean => {
      if (!rect) return false;
      return (
        x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
      );
    };

    // handle mousedown to prevent Canvas from changing selection
    // Canvas uses mousedown (not click) for selection, so we must intercept here
    const handleMouseDown = (e: MouseEvent) => {
      const { clientX, clientY } = e;

      const toolbarRect = toolbarRef.current?.getBoundingClientRect();
      const dropdownRect = dropdownRef.current?.getBoundingClientRect();

      const isInToolbar = isPointInRect(clientX, clientY, toolbarRect);
      const isInDropdown =
        isDropdownOpen && isPointInRect(clientX, clientY, dropdownRect);

      mouseDownInToolbar = isInToolbar || isInDropdown;

      if (isInToolbar || isInDropdown) {
        e.stopPropagation();
        e.preventDefault();
      }
    };

    const handleClick = (e: MouseEvent) => {
      const { clientX, clientY } = e;

      const isInToolbar = isPointInRect(
        clientX,
        clientY,
        toolbarRef.current?.getBoundingClientRect(),
      );
      const isInDropdown =
        isDropdownOpen &&
        isPointInRect(
          clientX,
          clientY,
          dropdownRef.current?.getBoundingClientRect(),
        );

      // always stop propagation if click is anywhere in toolbar or dropdown
      // this prevents the canvas from deselecting the text node
      if (isInToolbar || isInDropdown) {
        e.stopPropagation();
        e.preventDefault();
      }

      // Only process click if mousedown also started in toolbar
      // This prevents drag-release from triggering actions
      if (!mouseDownInToolbar) {
        mouseDownInToolbar = false;
        return;
      }
      mouseDownInToolbar = false;

      // check dropdown items first (if dropdown is open)
      if (isDropdownOpen) {
        for (const [v, el] of dropdownItemRefs.current.entries()) {
          if (isPointInRect(clientX, clientY, el?.getBoundingClientRect())) {
            onVariantChange(v);
            setIsDropdownOpen(false);
            return;
          }
        }
      }

      // check size trigger
      if (
        isPointInRect(
          clientX,
          clientY,
          triggerRef.current?.getBoundingClientRect(),
        )
      ) {
        setIsDropdownOpen((prev) => !prev);
        return;
      }

      // check bold button
      if (
        isPointInRect(
          clientX,
          clientY,
          boldRef.current?.getBoundingClientRect(),
        )
      ) {
        onBoldChange(!bold);
        return;
      }

      // click outside toolbar and dropdown - close dropdown if open
      if (isDropdownOpen && !isInToolbar && !isInDropdown) {
        setIsDropdownOpen(false);
      }
    };

    // prevent double-clicks from propagating to canvas (would trigger text edit mode)
    const handleDblClick = (e: MouseEvent) => {
      const { clientX, clientY } = e;

      const isInToolbar = isPointInRect(
        clientX,
        clientY,
        toolbarRef.current?.getBoundingClientRect(),
      );
      const isInDropdown =
        isDropdownOpen &&
        isPointInRect(
          clientX,
          clientY,
          dropdownRef.current?.getBoundingClientRect(),
        );

      if (isInToolbar || isInDropdown) {
        e.stopPropagation();
        e.preventDefault();
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      const { clientX, clientY } = e;
      let newHovered: string | null = null;

      // check dropdown items first (if dropdown is open)
      if (isDropdownOpen) {
        for (const [v, el] of dropdownItemRefs.current.entries()) {
          if (isPointInRect(clientX, clientY, el?.getBoundingClientRect())) {
            newHovered = `dropdown-${v}`;
            break;
          }
        }
      }

      // check size trigger
      if (
        !newHovered &&
        isPointInRect(
          clientX,
          clientY,
          triggerRef.current?.getBoundingClientRect(),
        )
      ) {
        newHovered = "trigger";
      }

      // check bold button
      if (
        !newHovered &&
        isPointInRect(
          clientX,
          clientY,
          boldRef.current?.getBoundingClientRect(),
        )
      ) {
        newHovered = "bold";
      }

      setHoveredElement(newHovered);
    };

    document.addEventListener("mousedown", handleMouseDown, { capture: true });
    document.addEventListener("click", handleClick, { capture: true });
    document.addEventListener("dblclick", handleDblClick, { capture: true });
    document.addEventListener("mousemove", handleMouseMove);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown, {
        capture: true,
      });
      document.removeEventListener("click", handleClick, { capture: true });
      document.removeEventListener("dblclick", handleDblClick, {
        capture: true,
      });
      document.removeEventListener("mousemove", handleMouseMove);
    };
  }, [isDropdownOpen, bold, onVariantChange, onBoldChange]);

  // override cursor to pointer when hovering over interactive elements
  useEffect(() => {
    if (hoveredElement) {
      const previousCursor = document.body.style.cursor;
      document.body.style.cursor = "pointer";
      return () => {
        document.body.style.cursor = previousCursor;
      };
    }
  }, [hoveredElement]);

  // store refs for dropdown items
  const setDropdownItemRef = useCallback(
    (v: TextVariant) => (el: HTMLButtonElement | null) => {
      if (el) {
        dropdownItemRefs.current.set(v, el);
      } else {
        dropdownItemRefs.current.delete(v);
      }
    },
    [],
  );

  const isTriggerHovered = hoveredElement === "trigger";
  const isBoldHovered = hoveredElement === "bold";

  return createPortal(
    <div
      ref={toolbarRef}
      className={`text-node-toolbar${isVisible ? " text-node-toolbar-visible" : ""}`}
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      <div className="text-node-toolbar-inner">
        <button
          ref={triggerRef}
          type="button"
          className={`text-node-toolbar-size-trigger${isDropdownOpen || isTriggerHovered ? " text-node-toolbar-size-trigger-hover" : ""}`}
        >
          <span className="text-node-toolbar-size-label">
            {VARIANT_LABELS[variant]}
          </span>
          <ChevronDownIcon size={16} strokeWidth={2} />
        </button>

        {isDropdownOpen && (
          <div ref={dropdownRef} className="text-node-toolbar-dropdown">
            {VARIANT_ORDER.map((v) => (
              <button
                key={v}
                ref={setDropdownItemRef(v)}
                type="button"
                className={`text-node-toolbar-dropdown-item text-node-toolbar-dropdown-item-${v}${v === variant ? " text-node-toolbar-dropdown-item-active" : ""}${hoveredElement === `dropdown-${v}` ? " text-node-toolbar-dropdown-item-hover" : ""}`}
              >
                <span className="text-node-toolbar-dropdown-check">
                  {v === variant && <CheckIcon size={14} strokeWidth={3} />}
                </span>
                {VARIANT_LABELS[v]}
              </button>
            ))}
          </div>
        )}

        <div className="text-node-toolbar-divider" />

        <button
          ref={boldRef}
          type="button"
          className={`text-node-toolbar-bold${bold ? " text-node-toolbar-bold-active" : ""}${isBoldHovered && !bold ? " text-node-toolbar-bold-hover" : ""}`}
          title="Bold"
        >
          B
        </button>
      </div>
    </div>,
    document.body,
  );
};

export default TextNodeToolbar;
