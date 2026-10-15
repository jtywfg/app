import type { NormalizedSlot } from '../types';

export type RatioOption = {
  label: string;
  value: number;
};

export type LayoutOption = {
  id: string;
  name: string;
  description: string;
};

export const RATIO_OPTIONS: RatioOption[] = [
  { label: '1:1', value: 1 },
  { label: '4:5', value: 4 / 5 },
  { label: '4:3', value: 4 / 3 },
  { label: '2:1', value: 2 },
  { label: '3:4', value: 3 / 4 },
  { label: '2:3', value: 2 / 3 },
  { label: '9:16', value: 9 / 16 },
];

export function getLayoutOptions(count: number): LayoutOption[] {
  if (count <= 2) {
    return [
      { id: 'split-v', name: '左右拼接', description: '经典分栏' },
      { id: 'split-h', name: '上下拼接', description: '纵向排布' },
      { id: 'feature-left', name: '主副构图', description: '大小照片组合' },
    ];
  }
  return [
    { id: 'grid', name: '整齐网格', description: `${count} 张照片` },
    { id: 'feature-left', name: '主图布局', description: '突出第一张照片' },
    { id: 'feature-top', name: '杂志布局', description: '大图搭配小图' },
  ];
}

function gridSlots(count: number, x = 0, y = 0, width = 1, height = 1): NormalizedSlot[] {
  const columns = count <= 2 ? count : Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / columns);
  return Array.from({ length: count }, (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    return {
      x: x + (column * width) / columns,
      y: y + (row * height) / rows,
      width: width / columns,
      height: height / rows,
    };
  });
}

export function getLayoutSlots(layoutId: string, count: number): NormalizedSlot[] {
  if (count <= 1) {
    return [{ x: 0, y: 0, width: 1, height: 1 }];
  }

  if (layoutId === 'split-v' && count === 2) {
    return [
      { x: 0, y: 0, width: 0.5, height: 1 },
      { x: 0.5, y: 0, width: 0.5, height: 1 },
    ];
  }

  if (layoutId === 'split-h' && count === 2) {
    return [
      { x: 0, y: 0, width: 1, height: 0.5 },
      { x: 0, y: 0.5, width: 1, height: 0.5 },
    ];
  }

  if (layoutId === 'feature-left' && count >= 2) {
    const remaining = count - 1;
    return [
      { x: 0, y: 0, width: 0.62, height: 1 },
      ...gridSlots(remaining, 0.62, 0, 0.38, 1),
    ];
  }

  if (layoutId === 'feature-top' && count >= 3) {
    const remaining = count - 1;
    return [
      { x: 0, y: 0, width: 1, height: 0.62 },
      ...gridSlots(remaining, 0, 0.62, 1, 0.38),
    ];
  }

  return gridSlots(count);
}
