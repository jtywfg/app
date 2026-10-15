/** Move each selected run one slot, preserving relative order of selected pages. */
export function moveSelectedPages<T extends { id: string }>(pages: T[], selected: string[], delta: -1 | 1): T[] {
  const result = [...pages];
  const ids = new Set(selected);
  const start = delta === -1 ? 1 : result.length - 2;
  for (let i = start; delta === -1 ? i < result.length : i >= 0; i -= delta) {
    const next = i + delta;
    if (ids.has(result[i].id) && !ids.has(result[next].id)) [result[i], result[next]] = [result[next], result[i]];
  }
  return result;
}

export function dropScanPage<T extends { id: string }>(pages: T[], id: string, target: number): T[] {
  const from = pages.findIndex((page) => page.id === id);
  if (from < 0 || target < 0 || target >= pages.length) return pages;
  const result = [...pages];
  result.splice(target, 0, ...result.splice(from, 1));
  return result;
}
