export type Point = { pageX: number; pageY: number };
export type FreeTransform = { x: number; y: number; scale: number; rotation: number };
export type GestureStart = FreeTransform & { center: Point; distance: number; angle: number; points: number };

const center = (points: Point[]) => points.length > 1
  ? { pageX: (points[0].pageX + points[1].pageX) / 2, pageY: (points[0].pageY + points[1].pageY) / 2 }
  : points[0];
const distance = (points: Point[]) => points.length > 1 ? Math.hypot(points[1].pageX - points[0].pageX, points[1].pageY - points[0].pageY) : 1;
const angle = (points: Point[]) => points.length > 1 ? Math.atan2(points[1].pageY - points[0].pageY, points[1].pageX - points[0].pageX) : 0;

export function startGesture(item: FreeTransform, points: Point[]): GestureStart {
  return { ...item, center: center(points), distance: distance(points), angle: angle(points), points: points.length };
}

export function updateGesture(
  start: GestureStart,
  points: Point[],
  canvasWidth: number,
  canvasHeight: number,
  itemWidth: number,
  itemHeight: number
): FreeTransform {
  const currentCenter = center(points);
  const nextScale = points.length > 1 && start.points > 1
    ? Math.max(0.38, Math.min(3.2, start.scale * distance(points) / Math.max(1, start.distance)))
    : start.scale;
  let angleDelta = angle(points) - start.angle;
  if (angleDelta > Math.PI) angleDelta -= Math.PI * 2;
  if (angleDelta < -Math.PI) angleDelta += Math.PI * 2;
  const nextRotation = points.length > 1 && start.points > 1
    ? start.rotation + angleDelta * 180 / Math.PI
    : start.rotation;
  const widthDelta = (nextScale - start.scale) * itemWidth / 2;
  const heightDelta = (nextScale - start.scale) * itemHeight / 2;
  return {
    x: Math.max(-canvasWidth * 0.9, Math.min(canvasWidth * 0.9, start.x + currentCenter.pageX - start.center.pageX - widthDelta)),
    y: Math.max(-canvasHeight * 0.9, Math.min(canvasHeight * 0.9, start.y + currentCenter.pageY - start.center.pageY - heightDelta)),
    scale: nextScale,
    rotation: nextRotation,
  };
}
