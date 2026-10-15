const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../src/lib/scannerGeometry.ts'), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const geometry = {};
vm.runInNewContext(output, { exports: geometry });
const plain = (value) => JSON.parse(JSON.stringify(value));

test('book splitting creates two ordered non-overlapping pages for both phone orientations', () => {
  for (const axis of ['vertical', 'horizontal']) {
    const [a, b] = geometry.defaultScanQuads(axis);
    assert.ok(geometry.validScanQuad(a)); assert.ok(geometry.validScanQuad(b));
    const field = axis === 'vertical' ? 'x' : 'y';
    assert.equal(Math.min(...a.map((p) => p[field])), 0);
    assert.equal(Math.max(...a.map((p) => p[field])), 0.5);
    assert.equal(Math.min(...b.map((p) => p[field])), 0.5);
    assert.equal(Math.max(...b.map((p) => p[field])), 1);
  }
});
test('dragging any crop edge moves its two endpoints equally and keeps the opposite edge fixed', () => {
  const start = [{ x: 0.15, y: 0.1 }, { x: 0.85, y: 0.1 }, { x: 0.85, y: 0.9 }, { x: 0.15, y: 0.9 }];
  for (let edge = 0; edge < 4; edge++) {
    const result = geometry.moveScanHandle(start, edge + 4, 0.03, -0.02);
    for (let i = 0; i < 4; i++) {
      if (i === edge || i === (edge + 1) % 4) { assert.ok(Math.abs(result[i].x - start[i].x - 0.03) < 1e-9); assert.ok(Math.abs(result[i].y - start[i].y + 0.02) < 1e-9); }
      else assert.deepEqual(plain(result[i]), start[i]);
    }
  }
});
test('manual crops reject crossed, concave, tiny, NaN and out-of-image polygons', () => {
  for (const points of [
    [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 0 }, { x: 0, y: 1 }],
    [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.2, y: 0.1 }, { x: 0, y: 1 }],
    [{ x: 0, y: 0 }, { x: 0.001, y: 0 }, { x: 0.001, y: 0.001 }, { x: 0, y: 0.001 }],
    [{ x: NaN, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }],
    [{ x: -1, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }],
  ]) assert.equal(geometry.validScanQuad(points), false);
});
test('extreme corner and edge drags never escape the image or cross crop boundaries', () => {
  const start = [{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.15 }, { x: 0.8, y: 0.9 }, { x: 0.1, y: 0.8 }];
  for (let handle = 0; handle < 8; handle++) for (const dx of [-10, -0.2, 0, 0.2, 10]) for (const dy of [-10, -0.2, 0, 0.2, 10]) {
    assert.ok(geometry.validScanQuad(geometry.moveScanHandle(start, handle, dx, dy)));
  }
});
test('crop handles map to the actual contained photo rather than black letterbox margins', () => {
  const rect = geometry.scanContainRect(400, 600, 1600, 900);
  assert.equal(rect.width, 400); assert.equal(rect.height, 225);
  assert.equal(rect.x, 0); assert.equal(rect.y, 187.5);
  const portrait = geometry.scanContainRect(400, 600, 900, 1600);
  assert.equal(portrait.height, 600); assert.equal(portrait.width, 337.5);
  assert.equal(portrait.x, 31.25);
});
