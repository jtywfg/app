import type { PhotoPanZoom } from './cropGesture';

export const PHOTO_DPI = 300;
export function pixelsToMM(pixels: number) { return pixels * 25.4 / PHOTO_DPI; }
export function mmToPixels(mm: number) { return Math.round(mm * PHOTO_DPI / 25.4); }

// Convert the visible gesture viewport back to source-image coordinates.
// Crop the original, not a screen capture, to retain the requested resolution.
export function getUtilityCrop(sourceWidth: number, sourceHeight: number, viewportWidth: number, viewportHeight: number, transform: PhotoPanZoom) {
  const cover = Math.max(viewportWidth / sourceWidth, viewportHeight / sourceHeight);
  const scale = cover * transform.scale;
  const width = Math.min(sourceWidth, Math.max(1, Math.floor(viewportWidth / scale)));
  const height = Math.min(sourceHeight, Math.max(1, Math.floor(viewportHeight / scale)));
  return {
    originX: Math.max(0, Math.min(sourceWidth - width, Math.round((sourceWidth - viewportWidth / scale) / 2 - transform.x * viewportWidth / scale))),
    originY: Math.max(0, Math.min(sourceHeight - height, Math.round((sourceHeight - viewportHeight / scale) / 2 - transform.y * viewportHeight / scale))),
    width, height,
  };
}
