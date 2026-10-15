const CANVAS_WIDTH = 300;
const CANVAS_HEIGHT = 420;
export type SuitPlacement = { x: number; y: number; scale: number; rotation: number };
export const DEFAULT_SUIT_PLACEMENT: SuitPlacement = { x: 0, y: 0, scale: 1, rotation: 0 };
type Face = { x: number; y: number; width: number; height: number };

// Normalized placement is shared by the editor, print sheet and export.
export function fitSuitToFace(face?: Face): SuitPlacement {
  if (!face || ![face.x, face.y, face.width, face.height].every(Number.isFinite) || face.width <= 0 || face.height <= 0) return { ...DEFAULT_SUIT_PLACEMENT };
  const scale = Math.max(0.8, Math.min(1.55, face.width / 0.48));
  const collarY = 1 - (1 - getSuitLandmarkY(305)) * scale;
  const neckY = Math.max(0.48, Math.min(0.82, face.y + face.height * 1.08));
  return { x: Math.max(-0.25, Math.min(0.25, face.x + face.width / 2 - 0.5)), y: neckY - collarY, scale, rotation: 0 };
}

export function suitPlacementTransform(placement: SuitPlacement) {
  return `translate(${placement.x * CANVAS_WIDTH} ${placement.y * CANVAS_HEIGHT}) translate(150 420) rotate(${placement.rotation}) scale(${placement.scale}) translate(-150 -420)`;
}
export const ID_PHOTO_SUIT_SCALE = 1.35;

export function getIDPhotoSuitTransform() {
  const translateX = (1 - ID_PHOTO_SUIT_SCALE) * CANVAS_WIDTH / 2;
  const translateY = (1 - ID_PHOTO_SUIT_SCALE) * CANVAS_HEIGHT;
  return `translate(${Number(translateX.toFixed(2))} ${Number(translateY.toFixed(2))}) scale(${ID_PHOTO_SUIT_SCALE})`;
}

export function getSuitLandmarkY(sourceY: number) {
  return (sourceY * ID_PHOTO_SUIT_SCALE + (1 - ID_PHOTO_SUIT_SCALE) * CANVAS_HEIGHT) / CANVAS_HEIGHT;
}

// SVG coordinates corrected for the target portrait aspect ratio. The bitmap
// keeps its original proportions in both electronic photos and print slots.
export function getRasterSuitRect(sourceWidth: number, sourceHeight: number, portraitWidth: number, portraitHeight: number) {
  const width = 420;
  return { x: (CANVAS_WIDTH - width) / 2, y: getSuitLandmarkY(305) * CANVAS_HEIGHT, width,
    height: width * sourceHeight / sourceWidth * portraitWidth / portraitHeight * CANVAS_HEIGHT / CANVAS_WIDTH };
}
