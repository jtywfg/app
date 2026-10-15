const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { PNG } = require('pngjs');
const ts = require('typescript');
const filename = path.join(__dirname, '../src/lib/formalwear.ts');
const catalog = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports: catalog, require: (asset) => path.resolve(path.dirname(filename), asset) });

test('every selectable custom garment decodes with matching dimensions and transparent background', () => {
  assert.equal(catalog.FORMALWEAR.男装.length, 14);
  assert.equal(catalog.FORMALWEAR.女装.length, 4);
  assert.equal(catalog.FORMALWEAR.童装.length, 3);
  assert.ok(catalog.FORMALWEAR.童装.every((item) => !item.source));
  for (const template of [...catalog.FORMALWEAR.男装, ...catalog.FORMALWEAR.女装]) {
    const image = PNG.sync.read(fs.readFileSync(template.source));
    assert.equal(image.width, template.width, template.id);
    assert.equal(image.height, template.height, template.id);
    let transparent = 0, foreground = 0;
    for (let i = 3; i < image.data.length; i += 4) {
      if (image.data[i] === 0) transparent++;
      if (image.data[i] > 128) foreground++;
    }
    assert.ok(transparent > image.width * image.height * 0.01, `${template.id}: background`);
    assert.ok(foreground > image.width * image.height * 0.1, `${template.id}: clothing retained`);
  }
});

test('former solid WebP backgrounds and the pink neck opening are transparent', () => {
  for (const id of ['men-13', 'men-14', 'women-01', 'women-02']) {
    const image = PNG.sync.read(fs.readFileSync(catalog.getFormalwearTemplate(id).source));
    const index = (Math.floor(image.height * 0.05) * image.width + Math.floor(image.width / 2)) * 4;
    assert.equal(image.data[index + 3], 0, id);
  }
});
