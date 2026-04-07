import {
  type ReactElement,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";

import { ChevronDownIcon } from "../../icons";
import { HomeIcon } from "../../icons";
import { PencilIcon } from "../../icons";
import { PlusIcon } from "../../icons";
import { useDesigns } from "../../hooks/useDesigns";

import "./DesignPageHeader.css";

type DesignPageHeaderProps = {
  isResponding?: boolean;
};

function DesignPageHeader({
  isResponding = false,
}: DesignPageHeaderProps): ReactElement {
  const { designs, currentDesign, selectDesign, updateDesign } = useDesigns();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [hoveredDesignId, setHoveredDesignId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);

  const title = currentDesign?.title || "Untitled";

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const updateHoveredFromPoint = useCallback((x: number, y: number) => {
    const listEl = listRef.current;
    if (!listEl) {
      setHoveredDesignId(null);
      return;
    }

    const hit = document.elementFromPoint(x, y);
    const hitEl = hit instanceof HTMLElement ? hit : null;
    const itemEl =
      hitEl?.closest<HTMLElement>(".design-page-header-dropdown-item") ?? null;

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

  const handleHomeClick = useCallback(() => {
    window.location.href = "/";
  }, []);

  const handleNewCanvas = useCallback(() => {
    if (isResponding) return;
    setIsOpen(false);
    navigate("/");
  }, [isResponding, navigate]);

  const handleSelectDesign = useCallback(
    (designId: string) => {
      if (editingId) return;
      selectDesign(designId);
      setIsOpen(false);
    },
    [selectDesign, editingId],
  );

  const handleEditClick = useCallback(
    (e: React.MouseEvent, designId: string, designTitle: string) => {
      e.stopPropagation();
      setEditValue(designTitle || "Untitled");
      setEditingId(designId);
    },
    [],
  );

  const handleEditSave = useCallback(
    (designId: string, originalTitle: string) => {
      const trimmed = editValue.trim();
      if (trimmed && trimmed !== originalTitle) {
        updateDesign({ id: designId, title: trimmed });
      }
      setEditingId(null);
    },
    [editValue, updateDesign],
  );

  const handleEditCancel = useCallback(() => {
    setEditingId(null);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: PointerEvent) => {
      const header = document.querySelector(".design-page-header");
      if (header && !header.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handleClickOutside);
    return () =>
      document.removeEventListener("pointerdown", handleClickOutside);
  }, [isOpen]);

  return (
    <div className="design-page-header">
      <div className="design-page-header-home-wrap">
        <button
          className="design-page-header-home"
          onClick={handleHomeClick}
          aria-label="Home"
        >
          <HomeIcon size={18} strokeWidth={2} />
        </button>
      </div>

      <div className="design-page-header-divider" />

      <div className="design-page-header-dropdown">
        <div className="design-page-header-dropdown-wrap">
          <button
            className="design-page-header-dropdown-trigger"
            onClick={() => setIsOpen(!isOpen)}
          >
            <span className="design-page-header-dropdown-title">{title}</span>
            <ChevronDownIcon size={16} strokeWidth={2} />
          </button>
        </div>

        {isOpen && (
          <div className="design-page-header-dropdown-menu">
            <div
              className={`design-page-header-dropdown-header${isScrolled ? " scrolled" : ""}`}
            >
              <span>Pages</span>
              <div className="design-page-header-add-button-wrap">
                <button
                  className="design-page-header-add-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNewCanvas();
                  }}
                  aria-label="New canvas"
                >
                  <PlusIcon size={16} strokeWidth={2} />
                </button>
              </div>
            </div>
            <div
              ref={listRef}
              className="design-page-header-dropdown-list"
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
              {designs.map((design) => {
                const itemTitle = design.title || "Untitled";
                const isEditing = editingId === design.id;
                return (
                  <div
                    key={design.id}
                    className={`design-page-header-dropdown-item${currentDesign?.id === design.id ? " active" : ""}${isEditing ? " editing" : ""}${hoveredDesignId === design.id ? " hovered" : ""}`}
                    data-design-id={design.id}
                    onClick={() => handleSelectDesign(design.id)}
                  >
                    {isEditing ? (
                      <input
                        ref={editInputRef}
                        type="text"
                        className="design-page-header-dropdown-item-input"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter")
                            handleEditSave(design.id, itemTitle);
                          if (e.key === "Escape") handleEditCancel();
                        }}
                        onBlur={() => handleEditSave(design.id, itemTitle)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <>
                        <span className="design-page-header-dropdown-item-title">
                          {itemTitle}
                        </span>
                        <button
                          className="design-page-header-dropdown-item-edit"
                          onClick={(e) =>
                            handleEditClick(e, design.id, itemTitle)
                          }
                          aria-label="Rename page"
                        >
                          <PencilIcon size={14} />
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DesignPageHeader;
