/**
 * Layout constants for the storyboard canvas.
 *
 * These constants control the sizing and spacing of elements on the canvas.
 * All values must be multiples of GRID_SIZE to ensure elements align to the grid.
 *
 * IMPORTANT: This file MUST be kept in sync with layout.py.
 */

// Grid
export const GRID_SIZE = 40; // Base grid unit (1 cell = 40px)

// Slot dimensions
export const SLOT_WIDTH = 1720; // 43 grid cells
export const SLOT_GAP = 120; // 3 grid cells (horizontal gap between slots)
export const SLOT_STRIDE = SLOT_WIDTH + SLOT_GAP; // 1840 = 46 grid cells
export const ROW_CAPTION_WIDTH = 2680; // 67 grid cells (wider text for row captions)

// Heights
export const TITLE_HEIGHT = 120; // 3 grid cells
export const DESCRIPTION_HEIGHT = 200; // 5 grid cells
export const ROW_CAPTION_HEIGHT = 80; // 2 grid cells
export const IMAGE_HEIGHT = 1120; // 28 grid cells
export const IMAGE_CAPTION_HEIGHT = 200; // 5 grid cells
export const QUESTION_LABEL_HEIGHT = 80; // 2 grid cells (height for decision lever question labels)

// Vertical gaps
export const TITLE_TO_DESC_GAP = 80; // 2 grid cells
export const DESC_TO_CONTENT_GAP = 160; // 4 grid cells
export const ROW_CAPTION_TO_IMAGE_GAP = 40; // 1 grid cell
export const IMAGE_TO_CAPTION_GAP = 40; // 1 grid cell
export const BETWEEN_ROWS_GAP = 200; // 5 grid cells
export const REVISION_GAP = 1000; // 25 grid cells (gap between revisions)

// Horizontal gaps for question groups
export const QUESTION_GROUP_GAP = 280; // 7 grid cells (larger gap between question groups)
export const QUESTION_LABEL_TO_IMAGE_GAP = 40; // 1 grid cell (gap between question label and images)
