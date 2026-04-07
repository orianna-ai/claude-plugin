import { useCallback } from "react";

import { LocateIcon, MinusIcon, PlusIcon } from "../../icons";

function CanvasControls() {
  const handleZoomIn = useCallback(() => {
    window.dispatchEvent(new CustomEvent("canvas-zoom-in"));
  }, []);

  const handleZoomOut = useCallback(() => {
    window.dispatchEvent(new CustomEvent("canvas-zoom-out"));
  }, []);

  const handleFitView = useCallback(() => {
    window.dispatchEvent(new CustomEvent("canvas-fit-view"));
  }, []);

  return (
    <div className="comments-sidebar-controls-floating">
      <button
        className="comments-sidebar-control-button"
        onClick={handleZoomOut}
        title="Zoom out"
        type="button"
      >
        <MinusIcon size={20} />
      </button>
      <button
        className="comments-sidebar-control-button"
        onClick={handleZoomIn}
        title="Zoom in"
        type="button"
      >
        <PlusIcon size={20} />
      </button>
      <button
        className="comments-sidebar-control-button"
        onClick={handleFitView}
        title="Find content"
        type="button"
      >
        <LocateIcon size={20} />
      </button>
    </div>
  );
}

export default CanvasControls;
