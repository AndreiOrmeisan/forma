import { validateWardrobeDraft } from "./wardrobe-configuration";

export type WardrobeViewMode = "interior" | "doors";

export type WardrobePreviewProps = {
  widthMm: number;
  heightMm: number;
  depthMm: number;
  doorsCount: number;
  shelvesCount: number;
  viewMode: WardrobeViewMode;
};

type Rectangle = { x: number; y: number; width: number; height: number };

export const previewViewport = { width: 360, height: 380 } as const;
const drawingArea = { x: 82, y: 34, width: 248, height: 274 };

export function createWardrobeLayout(input: WardrobePreviewProps) {
  const { configuration } = validateWardrobeDraft({
    width_mm: String(input.widthMm),
    height_mm: String(input.heightMm),
    depth_mm: String(input.depthMm),
    doors_count: String(input.doorsCount),
    shelves_count: String(input.shelvesCount),
  });
  if (!configuration || (input.viewMode !== "interior" && input.viewMode !== "doors")) return null;

  const scale = Math.min(drawingArea.width / input.widthMm, drawingArea.height / input.heightMm);
  const width = input.widthMm * scale;
  const height = input.heightMm * scale;
  const outline: Rectangle = {
    x: drawingArea.x + (drawingArea.width - width) / 2,
    y: drawingArea.y + (drawingArea.height - height) / 2,
    width,
    height,
  };

  // Panel thickness is schematic in drawing units, independent of material rules.
  const panel = Math.min(5, width / 8, height / 8);
  const interior: Rectangle = {
    x: outline.x + panel,
    y: outline.y + panel,
    width: width - 2 * panel,
    height: height - 2 * panel,
  };
  const panels: Rectangle[] = [
    { x: outline.x, y: outline.y, width: panel, height },
    { x: outline.x + width - panel, y: outline.y, width: panel, height },
    { x: interior.x, y: outline.y, width: interior.width, height: panel },
    { x: interior.x, y: outline.y + height - panel, width: interior.width, height: panel },
  ];

  const shelfThickness = Math.min(2, interior.height / (2 * input.shelvesCount + 1));
  const shelfGap = (interior.height - input.shelvesCount * shelfThickness) / (input.shelvesCount + 1);
  const shelves: Rectangle[] = input.viewMode === "interior" ? Array.from({ length: input.shelvesCount }, (_, index) => ({
    x: interior.x,
    y: interior.y + shelfGap * (index + 1) + shelfThickness * index,
    width: interior.width,
    height: shelfThickness,
  })) : [];

  const doorGap = Math.min(2, interior.width / 10);
  const doorWidth = (interior.width - doorGap * (input.doorsCount + 1)) / input.doorsCount;
  const handleInset = Math.min(7, doorWidth / 4);
  const handleLength = Math.min(18, interior.height / 5);
  const doors = input.viewMode === "doors" ? Array.from({ length: input.doorsCount }, (_, index) => {
    const door: Rectangle = {
      x: interior.x + doorGap + index * (doorWidth + doorGap),
      y: interior.y + doorGap,
      width: doorWidth,
      height: interior.height - 2 * doorGap,
    };
    return {
      ...door,
      handleX: input.doorsCount === 2 && index === 1 ? door.x + handleInset : door.x + door.width - handleInset,
      handleY: outline.y + height / 2 - handleLength / 2,
      handleLength,
    };
  }) : [];

  return {
    scale,
    outline,
    panels,
    shelves,
    doors,
    widthDimensionY: outline.y + height + 25,
    heightDimensionX: outline.x - 26,
  };
}
