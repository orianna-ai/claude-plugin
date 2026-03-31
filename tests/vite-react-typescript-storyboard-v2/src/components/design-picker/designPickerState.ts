let setIsOpenGlobal:
  | ((isOpen: boolean | ((prev: boolean) => boolean)) => void)
  | null = null;

const openListeners: Set<(isOpen: boolean) => void> = new Set();

export function registerSetIsOpen(
  setIsOpen: (isOpen: boolean | ((prev: boolean) => boolean)) => void,
) {
  setIsOpenGlobal = setIsOpen;
  return () => {
    setIsOpenGlobal = null;
  };
}

export function registerPickerOpenListener(
  listener: (isOpen: boolean) => void,
) {
  openListeners.add(listener);
  return () => {
    openListeners.delete(listener);
  };
}

export function toggleDesignPicker() {
  if (setIsOpenGlobal) {
    setIsOpenGlobal((prev) => {
      const newValue = !prev;
      openListeners.forEach((listener) => listener(newValue));
      return newValue;
    });
  }
}

export function openDesignPicker() {
  if (setIsOpenGlobal) {
    setIsOpenGlobal(true);
    openListeners.forEach((listener) => listener(true));
  }
}

export function closeDesignPicker() {
  if (setIsOpenGlobal) {
    setIsOpenGlobal(false);
    openListeners.forEach((listener) => listener(false));
  }
}
