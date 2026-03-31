import { useCallback, useEffect } from "react";
import { createPortal } from "react-dom";

import { XIcon } from "../../icons";

import "./ImageModal.css";

interface ImageModalProps {
  imageUrl: string | null;
  onClose: () => void;
}

function ImageModal({ imageUrl, onClose }: ImageModalProps) {
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (imageUrl) {
      window.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      window.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [imageUrl, onClose]);

  if (!imageUrl) {
    return null;
  }

  return createPortal(
    <div className="image-modal-backdrop" onClick={handleBackdropClick}>
      <div className="image-modal-content">
        <button
          type="button"
          className="image-modal-close"
          onClick={onClose}
          aria-label="Close modal"
        >
          <XIcon size={20} />
        </button>
        <img
          src={imageUrl}
          crossOrigin="anonymous"
          alt="Full size preview"
          className="image-modal-image"
        />
      </div>
    </div>,
    document.body,
  );
}

export default ImageModal;
