const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');
const output = ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname, '../src/lib/scanner.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
function load(native) {
  const exported = {};
  vm.runInNewContext(output, { exports: exported, require(name) {
    if (name === 'expo-modules-core') return { requireOptionalNativeModule: () => native };
    if (name === 'react-native') return { Platform: { OS: 'android' } };
    if (name === 'expo-sharing') return { isAvailableAsync() { throw new Error('Android saving must not depend on sharing'); }, shareAsync() { throw new Error('must not open a share sheet'); } };
    return {};
  } });
  return exported;
}
const pages = [{ image: { uri: 'file:///page-two.jpg' } }, { image: { uri: 'file:///page-one.jpg' } }];
test('PDF, DOCX and long JPEG persist in page order before returning a saved destination', async () => {
  for (const [format, extension, mime] of [['pdf', 'pdf', 'application/pdf'], ['word', 'docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'], ['long', 'jpg', 'image/jpeg']]) {
    const calls = [];
    const api = load({
      async export(uris, kind) { assert.equal(uris.join(','), 'file:///page-two.jpg,file:///page-one.jpg'); assert.equal(kind, format); calls.push('generate'); return 'file:///cache/export'; },
      async saveExport(uri, title, type, ext) { assert.equal(uri, 'file:///cache/export'); assert.equal(title, '合同'); assert.equal(type, mime); assert.equal(ext, extension); calls.push('persist'); return 'content://downloads/saved'; },
      async removeTemp() { calls.push('cleanup'); },
    });
    assert.equal(await api.exportScans(pages, format, '合同'), 'content://downloads/saved');
    assert.deepEqual(calls, ['generate', 'persist', 'cleanup']);
  }
});
test('write failures propagate and preserve the generated file for retry', async () => {
  const api = load({ async export() { return 'file:///cache/export'; }, async saveExport() { throw new Error('storage full'); }, async removeTemp() { assert.fail('failed save must not delete source'); } });
  await assert.rejects(api.exportScans(pages, 'pdf', '合同'), /storage full/);
});
test('cleanup failure cannot turn a successfully saved file into a failed export', async () => {
  const api = load({ async export() { return 'file:///cache/export'; }, async saveExport() { return 'content://downloads/saved'; }, async removeTemp() { throw new Error('cache busy'); } });
  assert.equal(await api.exportScans(pages, 'pdf', '合同'), 'content://downloads/saved');
});
