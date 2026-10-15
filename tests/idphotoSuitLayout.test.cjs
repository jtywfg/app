const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../src/lib/idphotoSuitLayout.ts'), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const layout = {};
vm.runInNewContext(output, { exports: layout });

test('suit scaling raises the collar from the lower quarter to the neck area', () => {
  assert.ok(layout.getSuitLandmarkY(305) < 0.64);
  assert.ok(layout.getSuitLandmarkY(320) < 0.69);
});
test('suit scale anchors the hem at the bottom and centers shoulder expansion', () => {
  assert.equal(layout.getSuitLandmarkY(420), 1);
  assert.equal(layout.getIDPhotoSuitTransform(), 'translate(-52.5 -147) scale(1.35)');
});

test('automatic fitting aligns collar height and horizontal center with the cropped face', () => {
  const face = { x: 0.31, y: 0.15, width: 0.48, height: 0.42 };
  const fit = layout.fitSuitToFace(face);
  assert.ok(Math.abs(fit.x - 0.05) < 1e-10);
  assert.equal(fit.scale, 1);
  const collar = 1 - (1 - layout.getSuitLandmarkY(305)) * fit.scale + fit.y;
  assert.ok(Math.abs(collar - (face.y + face.height * 1.08)) < 1e-10);
});

test('invalid face falls back safely and extreme face sizes are constrained', () => {
  for (const face of [undefined, { x: 0, y: 0, width: 0, height: 1 }, { x: NaN, y: 0, width: 1, height: 1 }]) {
    assert.deepEqual(JSON.parse(JSON.stringify(layout.fitSuitToFace(face))), { x: 0, y: 0, scale: 1, rotation: 0 });
  }
  assert.equal(layout.fitSuitToFace({ x: 0, y: 0, width: 0.1, height: 0.2 }).scale, 0.8);
  assert.equal(layout.fitSuitToFace({ x: 0, y: 0, width: 1, height: 1 }).scale, 1.55);
});

test('preview and export placement use resolution-independent canvas coordinates', () => {
  assert.equal(layout.suitPlacementTransform({ x: 0.1, y: -0.1, scale: 1.2, rotation: 10 }), 'translate(30 -42) translate(150 420) rotate(10) scale(1.2) translate(-150 -420)');
});

test('bitmap garments retain their proportions on square and portrait certificate canvases', () => {
  for (const [width, height] of [[295, 413], [413, 579], [602, 602]]) {
    const rect = layout.getRasterSuitRect(1080, 695, width, height);
    const renderedWidth = rect.width / 300 * width;
    const renderedHeight = rect.height / 420 * height;
    assert.ok(Math.abs(renderedWidth / renderedHeight - 1080 / 695) < 1e-10);
    assert.equal(rect.y / 420, layout.getSuitLandmarkY(305));
    const preview = layout.getRasterSuitRect(1080, 695, width / 3, height / 3);
    assert.ok(Math.abs(rect.height - preview.height) < 1e-10);
  }
});
