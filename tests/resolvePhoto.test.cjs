const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../src/lib/resolvePhoto.ts'), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exportsObject = {};
vm.runInNewContext(output, { exports: exportsObject });
const { resolvePhoto } = exportsObject;
const photo = { id: '42', uri: 'file:///storage/emulated/0/DCIM/photo.jpg', width: 1200, height: 900, library: true };
const forbiddenMetadata = async () => { throw new Error('missing ACCESS_MEDIA_LOCATION permission'); };

test('Android single and multi-selection work without EXIF/location permission', async () => {
  const single = await resolvePhoto(photo, 'android', forbiddenMetadata);
  assert.equal(single.uri, photo.uri);
  assert.equal(single.width, photo.width);
  const selected = [photo, { ...photo, id: '43', uri: 'content://media/external/images/media/43' }];
  const multi = await Promise.all(selected.map((choice) => resolvePhoto(choice, 'android', forbiddenMetadata)));
  assert.equal(multi.length, 2);
  multi.forEach((item, index) => assert.equal(item.uri, selected[index].uri));
});

test('Camera photos bypass gallery metadata on both platforms', async () => {
  for (const platform of ['android', 'ios']) {
    const result = await resolvePhoto({ ...photo, library: false }, platform, forbiddenMetadata);
    assert.equal(result.uri, photo.uri);
  }
});

test('iOS resolves ph:// and downloads cloud assets before editing', async () => {
  let calls = 0;
  const result = await resolvePhoto({ ...photo, uri: 'ph://42' }, 'ios', async (id, options) => {
    calls++;
    assert.equal(id, '42');
    assert.equal(options.shouldDownloadFromNetwork, true);
    return { uri: 'ph://42', localUri: 'file:///cache/photo.jpg', width: 900, height: 1200, filename: 'photo.jpg' };
  });
  assert.equal(calls, 1);
  assert.equal(result.uri, 'file:///cache/photo.jpg');
  assert.equal(result.height, 1200);
});

test('iOS read failures propagate so the album can show an error', async () => {
  await assert.rejects(resolvePhoto({ ...photo, uri: 'ph://42' }, 'ios', async () => { throw new Error('download failed'); }), /download failed/);
});
