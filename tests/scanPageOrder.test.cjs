const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');
const exported = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname, '../src/lib/scanPageOrder.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: exported });
const pages = 'abcdef'.split('').map((id) => ({ id }));
const ids = (list) => list.map((page) => page.id).join('');

test('batch moves preserve selected page order, including separated selections', () => {
  assert.equal(ids(exported.moveSelectedPages(pages, ['b', 'c', 'e'], -1)), 'bcaedf');
  assert.equal(ids(exported.moveSelectedPages(pages, ['b', 'c', 'e'], 1)), 'adbcfe');
  assert.equal(ids(pages), 'abcdef');
});
test('boundary selections remain in place and do not block other selected runs', () => {
  assert.equal(ids(exported.moveSelectedPages(pages, ['a', 'b', 'e'], -1)), 'abcedf');
  assert.equal(ids(exported.moveSelectedPages(pages, ['b', 'e', 'f'], 1)), 'acbdef');
  assert.equal(ids(exported.moveSelectedPages(pages, pages.map((p) => p.id), 1)), 'abcdef');
});
test('dragging works in both directions and retains the actual page objects', () => {
  const moved = exported.dropScanPage(pages, 'b', 4);
  assert.equal(ids(moved), 'acdebf');
  assert.equal(moved[4], pages[1]);
  assert.equal(ids(exported.dropScanPage(pages, 'f', 0)), 'fabcde');
  assert.equal(exported.dropScanPage(pages, 'unknown', 0), pages);
});
