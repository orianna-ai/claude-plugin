import type { ReactElement } from "react";

import { MenuIcon } from "../../icons";

import { toggleDesignPicker } from "./designPickerState";

import "./DesignPickerToggle.css";

function DesignPickerToggle(): ReactElement {
  return (
    <button
      className="design-picker-toggle"
      onClick={toggleDesignPicker}
      aria-label="Toggle design picker"
    >
      <MenuIcon size={20} />
    </button>
  );
}

export default DesignPickerToggle;
