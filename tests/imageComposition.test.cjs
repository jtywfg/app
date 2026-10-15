const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

function loadModule(relativePath, dependencies = {}) {
  const source = fs.readFileSync(path.join(__dirname, relativePath), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exportsObject = {};
  vm.runInNewContext(output, { exports: exportsObject, require: (name) => dependencies[name] });
  return exportsObject;
}

const composition = loadModule('../src/lib/imageComposition.ts');

test('grid slices are row-major and cover every output pixel exactly once', () => {
  const width = 1201;
  const height = 1600;
  const slices = composition.getGridSlices(width, height, 3, 4);
  assert.equal(slices.length, 12);
  assert.deepEqual(Array.from(slices, (slice) => slice.index), Array.from({ length: 12 }, (_, index) => index));
  assert.equal(slices[0].x, 0);
  assert.equal(slices[0].y, 0);
  assert.equal(slices.at(-1).x + slices.at(-1).width, width);
  assert.equal(slices.at(-1).y + slices.at(-1).height, height);
  const area = slices.reduce((sum, slice) => sum + slice.width * slice.height, 0);
  assert.equal(area, width * height);
  for (let index = 0; index < slices.length; index += 1) {
    const current = slices[index];
    for (const other of slices.slice(index + 1)) {
      const overlapWidth = Math.max(0, Math.min(current.x + current.width, other.x + other.width) - Math.max(current.x, other.x));
      const overlapHeight = Math.max(0, Math.min(current.y + current.height, other.y + other.height) - Math.max(current.y, other.y));
      assert.equal(overlapWidth * overlapHeight, 0);
    }
  }
});

test('long-image export keeps its aspect ratio under mobile output limits', () => {
  const output = composition.fitOutputSize(360, 24000);
  assert.ok(output.width <= 1200);
  assert.ok(output.height <= 16000);
  assert.ok(output.width * output.height <= 12_000_000);
  assert.ok(Math.abs(output.width / output.height - 360 / 24000) < 0.001);
});
