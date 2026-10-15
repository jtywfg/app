import { updateGesture, type FreeTransform, type GestureStart, type Point } from './freeTransform';

export function updateGridGesture(
  start: GestureStart,
  points: Point[],
  canvasWidth: number,
  canvasHeight: number,
  imageWidth: number,
  imageHeight: number
): FreeTransform {
  const transformed = updateGesture(start, points, canvasWidth, canvasHeight, imageWidth, imageHeight);
  const radians = transformed.rotation * Math.PI / 180;
  const rotatedWidth = Math.abs(imageWidth * transformed.scale * Math.cos(radians)) + Math.abs(imageHeight * transformed.scale * Math.sin(radians));
  const rotatedHeight = Math.abs(imageWidth * transformed.scale * Math.sin(radians)) + Math.abs(imageHeight * transformed.scale * Math.cos(radians));
  const maxX = Math.max(0, (rotatedWidth - canvasWidth) / 2);
  const maxY = Math.max(0, (rotatedHeight - canvasHeight) / 2);
  return {
    ...transformed,
    x: Math.max(-maxX, Math.min(maxX, transformed.x)),
    y: Math.max(-maxY, Math.min(maxY, transformed.y)),
  };
}
