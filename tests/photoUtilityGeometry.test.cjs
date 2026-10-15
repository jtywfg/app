const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../src/lib/photoUtilityGeometry.ts'), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const geometry = {};
vm.runInNewContext(output, { exports: geometry });

test('300 DPI millimeter conversion round trips common certificate dimensions', () => {
  for (const pixels of [295, 413, 531, 579, 1170, 663]) {
    assert.equal(geometry.mmToPixels(Number(geometry.pixelsToMM(pixels).toFixed(2))), pixels);
  }
});
test('center crop retains the requested aspect without stretching a landscape source', () => {
  const crop = geometry.getUtilityCrop(1200, 800, 200, 280, { x: 0, y: 0, scale: 1 });
  assert.equal(crop.height, 800);
  assert.equal(crop.width, 571);
  assert.ok(Math.abs(crop.originX - 314) <= 1);
});
test('pinch zoom and movement export the same region as the preview', () => {
  const crop = geometry.getUtilityCrop(1000, 1400, 200, 280, { x: 0.25, y: -0.1, scale: 2 });
  assert.equal(crop.width, 500);
  assert.equal(crop.height, 700);
  assert.equal(crop.originX, 125);
  assert.equal(crop.originY, 420);
});
test('viewport resizing between crop and preview keeps the source crop unchanged', () => {
  const transform = { x: 0.1, y: 0.05, scale: 1.5 };
  const a = geometry.getUtilityCrop(1200, 1800, 200, 280, transform);
  const b = geometry.getUtilityCrop(1200, 1800, 300, 420, transform);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});
test('even extreme panning cannot export outside source image bounds', () => {
  for (const x of [-10, 10]) for (const y of [-10, 10]) {
    const crop = geometry.getUtilityCrop(1200, 800, 200, 280, { x, y, scale: 4 });
    assert.ok(crop.originX >= 0 && crop.originY >= 0);
    assert.ok(crop.originX + crop.width <= 1200);
    assert.ok(crop.originY + crop.height <= 800);
  }
});
