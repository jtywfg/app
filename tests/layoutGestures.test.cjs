const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

function loadModule(relativePath) {
  const source = fs.readFileSync(path.join(__dirname, relativePath), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exportsObject = {};
  vm.runInNewContext(output, { exports: exportsObject });
  return exportsObject;
}

const layouts = loadModule('../src/lib/layouts.ts');
const adjustable = loadModule('../src/lib/adjustableLayout.ts');
const crop = loadModule('../src/lib/cropGesture.ts');
const free = loadModule('../src/lib/freeTransform.ts');

test('dragging a horizontal split shrinks one region as the other grows', () => {
  const original = layouts.getLayoutSlots('split-h', 2);
  const xCuts = adjustable.getInternalCuts(original, 'x');
  const yCuts = adjustable.getInternalCuts(original, 'y');
  const movedY = adjustable.moveCut(yCuts, 0, -0.18);
  const result = adjustable.applyCuts(original, xCuts, xCuts, yCuts, movedY);
  assert.ok(Math.abs(result[0].height - 0.32) < 1e-6);
  assert.ok(Math.abs(result[1].height - 0.68) < 1e-6);
  assert.ok(Math.abs(result[0].height + result[1].height - 1) < 1e-6);
});

test('magazine top/bottom divider only appears across the shared photo edge', () => {
  const slots = layouts.getLayoutSlots('feature-top', 3);
  const segments = adjustable.getDividerSegments(slots);
  const horizontal = segments.filter((segment) => segment.axis === 'y');
  assert.equal(horizontal.length, 1);
  assert.equal(horizontal[0].value, 0.62);
  assert.equal(horizontal[0].start, 0);
  assert.equal(horizontal[0].end, 1);
});

test('cropping supports one-finger movement within cover overflow and pinch zoom', () => {
  const points = [{ pageX: 0, pageY: 0 }];
  const start = crop.startCropGesture({ x: 0, y: 0, scale: 1 }, points, 0.5, 0);
  const moved = crop.updateCropGesture(start, [{ pageX: 80, pageY: 40 }], 100, 100);
  assert.equal(moved.x, 0.5);
  assert.equal(moved.y, 0);
  const pinchStart = crop.startCropGesture({ x: 0, y: 0, scale: 1 }, [{ pageX: 0, pageY: 0 }, { pageX: 100, pageY: 0 }], 0.5, 0);
  const zoomed = crop.updateCropGesture(pinchStart, [{ pageX: 0, pageY: 0 }, { pageX: 200, pageY: 0 }], 100, 100);
  assert.equal(zoomed.scale, 2);
});

test('free collage two-finger gesture pans, zooms, and rotates together', () => {
  const start = free.startGesture({ x: 100, y: 100, scale: 1, rotation: 0 }, [{ pageX: 100, pageY: 100 }, { pageX: 200, pageY: 100 }]);
  const result = free.updateGesture(start, [{ pageX: 160, pageY: 170 }, { pageX: 160, pageY: 370 }], 400, 600, 100, 100);
  assert.equal(result.scale, 2);
  assert.equal(result.rotation, 90);
  assert.equal(result.x, 60);
  assert.equal(result.y, 220);
});

test('free collage single-finger drag changes position without altering size or angle', () => {
  const start = free.startGesture({ x: 40, y: 70, scale: 1.3, rotation: 22 }, [{ pageX: 100, pageY: 100 }]);
  const result = free.updateGesture(start, [{ pageX: 135, pageY: 120 }], 400, 600, 90, 97);
  assert.equal(result.x, 75);
  assert.equal(result.y, 90);
  assert.equal(result.scale, 1.3);
  assert.equal(result.rotation, 22);
});
