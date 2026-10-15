export type Point = { pageX: number; pageY: number };
export type PhotoPanZoom = { x: number; y: number; scale: number };
export type CropGestureStart = PhotoPanZoom & { center: Point; distance: number; points: number; overflowX: number; overflowY: number };

function center(points: Point[]) {
  return points.length > 1
    ? { pageX: (points[0].pageX + points[1].pageX) / 2, pageY: (points[0].pageY + points[1].pageY) / 2 }
    : points[0];
}

function distance(points: Point[]) {
  return points.length > 1 ? Math.hypot(points[1].pageX - points[0].pageX, points[1].pageY - points[0].pageY) : 1;
}

export function startCropGesture(photo: PhotoPanZoom, points: Point[], overflowX = 0, overflowY = 0): CropGestureStart {
  return { ...photo, center: center(points), distance: distance(points), points: points.length, overflowX, overflowY };
}

export function updateCropGesture(start: CropGestureStart, points: Point[], cellWidth: number, cellHeight: number): PhotoPanZoom {
  const nextScale = points.length > 1 && start.points > 1
    ? Math.max(1, Math.min(4, start.scale * distance(points) / Math.max(1, start.distance)))
    : start.scale;
  const centerDelta = center(points);
  const maxX = start.overflowX * nextScale + (nextScale - 1) / 2;
  const maxY = start.overflowY * nextScale + (nextScale - 1) / 2;
  return {
    x: Math.max(-maxX, Math.min(maxX, start.x + (centerDelta.pageX - start.center.pageX) / Math.max(1, cellWidth))),
    y: Math.max(-maxY, Math.min(maxY, start.y + (centerDelta.pageY - start.center.pageY) / Math.max(1, cellHeight))),
    scale: nextScale,
  };
}
