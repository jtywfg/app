export type GridSlice = { index: number; column: number; row: number; x: number; y: number; width: number; height: number };

export const GRID_OPTIONS = [
  { columns: 3, rows: 1, label: '3 格' },
  { columns: 3, rows: 2, label: '6 格' },
  { columns: 3, rows: 3, label: '9 格' },
  { columns: 3, rows: 4, label: '12 格' },
] as const;

export function getGridSlices(width: number, height: number, columns: number, rows: number): GridSlice[] {
  if (![width, height, columns, rows].every(Number.isFinite) || width < 1 || height < 1 || columns < 1 || rows < 1) {
    throw new Error('网格尺寸必须为正数。');
  }
  const slices: GridSlice[] = [];
  for (let row = 0; row < rows; row += 1) {
    const top = Math.round(row * height / rows);
    const bottom = Math.round((row + 1) * height / rows);
    for (let column = 0; column < columns; column += 1) {
      const left = Math.round(column * width / columns);
      const right = Math.round((column + 1) * width / columns);
      slices.push({ index: row * columns + column, column, row, x: left, y: top, width: right - left, height: bottom - top });
    }
  }
  return slices;
}

export function fitOutputSize(width: number, height: number, maxWidth = 1200, maxHeight = 16000, maxPixels = 12_000_000) {
  if (![width, height, maxWidth, maxHeight, maxPixels].every(Number.isFinite) || width < 1 || height < 1) {
    throw new Error('图片尺寸无效。');
  }
  const scale = Math.min(maxWidth / width, maxHeight / height, Math.sqrt(maxPixels / (width * height)));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
