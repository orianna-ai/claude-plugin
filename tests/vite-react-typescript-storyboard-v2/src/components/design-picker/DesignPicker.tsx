import {
  type ReactElement,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";

import { PlusIcon } from "../../icons";
import { useDesigns } from "../../hooks/useDesigns";

import DesignPickerItem from "./DesignPickerItem";
import { closeDesignPicker, registerSetIsOpen } from "./designPickerState";
import { UserIdentity } from "./UserIdentity";

import "./DesignPicker.css";

type DesignPickerProps = {
  variant?: "home" | "chat";
  isResponding?: boolean;
};

function DesignPicker({
  variant = "chat",
  isResponding = false,
}: DesignPickerProps): ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const { designs } = useDesigns();
  const navigate = useNavigate();
  const [isAnimating, setIsAnimating] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [hoveredDesignId, setHoveredDesignId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);

  const isHome = variant === "home";

  const updateHoveredFromPoint = useCallback((x: number, y: number) => {
    const listEl = listRef.current;
    if (!listEl) {
      setHoveredDesignId(null);
      return;
    }

    const hit = document.elementFromPoint(x, y);
    const hitEl = hit instanceof HTMLElement ? hit : null;
    const itemEl = hitEl?.closest<HTMLElement>(".design-picker-item") ?? null;

    if (!itemEl || !listEl.contains(itemEl)) {
      setHoveredDesignId(null);
      return;
    }

    setHoveredDesignId(itemEl.dataset.designId ?? null);
  }, []);

  const handleScroll = useCallback(() => {
    if (listRef.current) {
      setIsScrolled(listRef.current.scrollTop > 0);
    }

    const last = lastPointerRef.current;
    if (last) {
      updateHoveredFromPoint(last.x, last.y);
    }
  }, [updateHoveredFromPoint]);

  useEffect(() => {
    if (isHome) return;
    return registerSetIsOpen(setIsOpen);
  }, [isHome]);

  useEffect(() => {
    if (isHome) return;
    if (isOpen) {
      setShouldRender(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
    } else {
      setIsAnimating(false);
      const timer = setTimeout(() => setShouldRender(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isHome]);

  useEffect(() => {
    if (isHome || !isOpen) return;

    const handleClickOutside = (e: PointerEvent) => {
      const picker = document.querySelector(".design-picker");
      if (picker && !picker.contains(e.target as Node)) {
        closeDesignPicker();
      }
    };

    document.addEventListener("pointerdown", handleClickOutside);
    return () =>
      document.removeEventListener("pointerdown", handleClickOutside);
  }, [isOpen, isHome]);

  const handleNewCanvas = useCallback(() => {
    closeDesignPicker();
    navigate("/");
  }, [navigate]);

  if (!isHome && !shouldRender) return <></>;

  return (
    <div
      className={`design-picker ${isHome ? "home" : isAnimating ? "open" : "closing"}`}
    >
      <div className="design-picker-header">
        <img
          src="https://drive.orianna.ai/c5a6c9723f9c17da50bbc9c9793a67d6.svg"
          alt="Softlight"
          className="design-picker-logo"
        />
        <UserIdentity />
      </div>
      <div
        className={`design-picker-section-header${isScrolled ? " scrolled" : ""}`}
      >
        <span className="design-picker-section-title">Pages</span>
        <button
          className={`design-picker-add-button${isResponding ? " disabled" : ""}`}
          disabled={isResponding}
          onClick={handleNewCanvas}
          aria-label="New canvas"
        >
          <PlusIcon size={16} strokeWidth={2} />
        </button>
      </div>
      <div
        ref={listRef}
        className="design-picker-list"
        onScroll={handleScroll}
        onPointerMove={(e) => {
          lastPointerRef.current = { x: e.clientX, y: e.clientY };
          updateHoveredFromPoint(e.clientX, e.clientY);
        }}
        onPointerLeave={() => {
          lastPointerRef.current = null;
          setHoveredDesignId(null);
        }}
      >
        {designs.length === 0 ? (
          <div className="design-picker-empty">No pages</div>
        ) : (
          designs.map((design) => (
            <DesignPickerItem
              key={design.id}
              design={design}
              isHome={isHome}
              isHovered={hoveredDesignId === design.id}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default DesignPicker;
