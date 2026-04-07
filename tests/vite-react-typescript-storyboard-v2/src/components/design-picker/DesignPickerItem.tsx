import { type ReactElement, useEffect, useRef, useState } from "react";

import { PencilIcon } from "../../icons";
import { useDesigns } from "../../hooks/useDesigns";
import type { Design } from "../../hooks/useDesigns";

import { closeDesignPicker } from "./designPickerState";

import "./DesignPickerItem.css";

type DesignPickerItemProps = {
  design: Design;
  isHome?: boolean;
  isHovered?: boolean;
};

function DesignPickerItem({
  design,
  isHome = false,
  isHovered = false,
}: DesignPickerItemProps): ReactElement {
  const { currentDesign, selectDesign, updateDesign } = useDesigns();

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const isActive = !isHome && currentDesign?.id === design.id;

  const title = !design.title
    ? "New canvas"
    : design.title || "Untitled Design";

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSelect = () => {
    if (!isEditing) {
      selectDesign(design.id);
      closeDesignPicker();
    }
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditValue(title);
    setIsEditing(true);
  };

  const handleSave = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== title) {
      updateDesign({
        id: design.id,
        title: trimmed,
      });
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(title);
    setIsEditing(false);
  };

  return (
    <div
      className={`design-picker-item${isActive ? " active" : ""}${isEditing ? " editing" : ""}${isHovered ? " hovered" : ""}`}
      data-design-id={design.id}
      onClick={handleSelect}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          className="design-picker-item-input"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") handleCancel();
          }}
          onBlur={handleSave}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <>
          <span className="design-picker-item-title">{title}</span>
          <button
            className="design-picker-item-edit-button"
            onClick={handleEditClick}
            aria-label="Rename page"
          >
            <PencilIcon size={14} />
          </button>
        </>
      )}
    </div>
  );
}

export default DesignPickerItem;
