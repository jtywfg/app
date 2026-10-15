import type { NormalizedSlot } from '../types';

export type Axis = 'x' | 'y';
export type DividerSegment = { axis: Axis; value: number; start: number; end: number; index: number };

const rounded = (value: number) => Number(value.toFixed(4));

export function getInternalCuts(slots: NormalizedSlot[], axis: Axis): number[] {
  const size = axis === 'x' ? 'width' : 'height';
  return [...new Set(slots.flatMap((slot) => [slot[axis], slot[axis] + slot[size]]).map(rounded))]
    .filter((value) => value > 0.001 && value < 0.999)
    .sort((a, b) => a - b);
}

export function getDividerSegments(slots: NormalizedSlot[]): DividerSegment[] {
  const segments: DividerSegment[] = [];
  (['x', 'y'] as const).forEach((axis) => {
    const size = axis === 'x' ? 'width' : 'height';
    const crossAxis = axis === 'x' ? 'y' : 'x';
    const crossSize = axis === 'x' ? 'height' : 'width';
    getInternalCuts(slots, axis).forEach((value, index) => {
      const ranges = slots
        .filter((slot) => Math.abs(slot[axis] - value) < 0.001 || Math.abs(slot[axis] + slot[size] - value) < 0.001)
        .map((slot) => [slot[crossAxis], slot[crossAxis] + slot[crossSize]] as const)
        .sort((a, b) => a[0] - b[0]);
      const merged: [number, number][] = [];
      ranges.forEach(([start, end]) => {
        const last = merged[merged.length - 1];
        if (last && start <= last[1] + 0.001) last[1] = Math.max(last[1], end);
        else merged.push([start, end]);
      });
      merged.forEach(([start, end]) => segments.push({ axis, value, start, end, index }));
    });
  });
  return segments;
}

export function moveCut(cuts: number[], index: number, delta: number, minimumGap = 0.12): number[] {
  const before = index === 0 ? 0 : cuts[index - 1];
  const after = index === cuts.length - 1 ? 1 : cuts[index + 1];
  return cuts.map((value, cutIndex) => cutIndex === index
    ? Math.max(before + minimumGap, Math.min(after - minimumGap, value + delta))
    : value);
}

function remap(value: number, originalCuts: number[], currentCuts: number[]) {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  const original = [0, ...originalCuts, 1];
  const current = [0, ...currentCuts, 1];
  const segment = Math.max(0, original.findIndex((end) => end >= value) - 1);
  const progress = (value - original[segment]) / (original[segment + 1] - original[segment]);
  return current[segment] + progress * (current[segment + 1] - current[segment]);
}

export function applyCuts(
  slots: NormalizedSlot[],
  originalX: number[],
  currentX: number[],
  originalY: number[],
  currentY: number[]
): NormalizedSlot[] {
  return slots.map((slot) => {
    const x = remap(slot.x, originalX, currentX);
    const right = remap(slot.x + slot.width, originalX, currentX);
    const y = remap(slot.y, originalY, currentY);
    const bottom = remap(slot.y + slot.height, originalY, currentY);
    return { x, y, width: right - x, height: bottom - y };
  });
}
