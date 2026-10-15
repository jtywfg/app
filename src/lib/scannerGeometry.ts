export type ScanPoint = { x: number; y: number };
export type ScanQuad = [ScanPoint, ScanPoint, ScanPoint, ScanPoint];
export type ScanSplit = 'none' | 'vertical' | 'horizontal';
export const fullScanQuad = (): ScanQuad => [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
export function defaultScanQuads(split: ScanSplit): ScanQuad[] {
  if (split === 'none') return [fullScanQuad()];
  return [0, 1].map((half) => fullScanQuad().map((point) => split === 'vertical' ? { x: (point.x + half) / 2, y: point.y } : { x: point.x, y: (point.y + half) / 2 }) as ScanQuad);
}
export function validScanQuad(points: ScanQuad) {
  if (!points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1)) return false;
  const crosses = points.map((a, i) => { const b = points[(i + 1) % 4]; const c = points[(i + 2) % 4]; return (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x); });
  const area = points.reduce((sum, p, i) => { const q = points[(i + 1) % 4]; return sum + p.x * q.y - p.y * q.x; }, 0) / 2;
  return crosses.every((n) => n > 0.00005) && area > 0.005;
}
// Handles 0..3 move a corner, 4..7 translate an edge. Keep the polygon convex.
export function moveScanHandle(start: ScanQuad, handle: number, dx: number, dy: number): ScanQuad {
  const indices = handle < 4 ? [handle] : [handle - 4, (handle - 3) % 4];
  const minX = Math.min(...indices.map((i) => start[i].x)); const maxX = Math.max(...indices.map((i) => start[i].x));
  const minY = Math.min(...indices.map((i) => start[i].y)); const maxY = Math.max(...indices.map((i) => start[i].y));
  const x = Math.max(-minX, Math.min(1 - maxX, dx)); const y = Math.max(-minY, Math.min(1 - maxY, dy));
  const candidate = start.map((p, i) => indices.includes(i) ? { x: p.x + x, y: p.y + y } : { ...p }) as ScanQuad;
  return validScanQuad(candidate) ? candidate : start;
}
export function scanContainRect(width: number, height: number, imageWidth: number, imageHeight: number) {
  const scale = Math.min(width / imageWidth, height / imageHeight);
  const w = imageWidth * scale; const h = imageHeight * scale;
  return { x: (width - w) / 2, y: (height - h) / 2, width: w, height: h };
}
