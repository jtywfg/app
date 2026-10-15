const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../src/lib/persistGalleryPhoto.ts'), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exportsObject = {};
vm.runInNewContext(output, { exports: exportsObject });
const { persistGalleryPhoto, PINPIC_ALBUM } = exportsObject;

test('Android saves to the public PinPic album and verifies the exact file in MediaStore', async () => {
  const calls = [];
  const uri = 'file:///cache/PinPic_123456abc.jpg';
  const library = {
    async createAssetAsync() { throw new Error('must use album scanner on Android'); },
    async createAlbumAsync(...args) { calls.push(['album', ...args]); return { id: 'pinpic-album' }; },
    async getAssetsAsync(options) {
      calls.push(['query', options]);
      return { assets: [{ filename: 'older.jpg' }, { filename: 'PinPic_123456abc.jpg' }] };
    },
  };
  const destination = await persistGalleryPhoto(uri, 'android', library);
  assert.equal(destination, '系统图库的「PinPic」相册');
  assert.equal(calls[0][1], PINPIC_ALBUM);
  assert.equal(calls[0][4], uri);
  assert.equal(calls[1][1].album, 'pinpic-album');
  assert.equal(calls[1][1].sortBy[0][0], 'creationTime');
});

test('Android refuses to show a success state when MediaStore cannot find the saved file', async () => {
  const library = {
    async createAssetAsync() { throw new Error('not used'); },
    async createAlbumAsync() { return { id: 'pinpic-album' }; },
    async getAssetsAsync() { return { assets: [{ filename: 'other.jpg' }] }; },
  };
  await assert.rejects(persistGalleryPhoto('file:///cache/PinPic_missing.jpg', 'android', library), /尚未确认登记/);
});

test('iOS writes to the system photo library and groups works in the PinPic album when readable', async () => {
  let savedUri;
  const calls = [];
  const library = {
    async createAssetAsync(uri) { savedUri = uri; return { id: 'ph://saved-photo' }; },
    async getAlbumsAsync() { return [{ id: 'existing-album', title: 'PinPic' }]; },
    async addAssetsToAlbumAsync(asset, album) { calls.push([asset.id, album.id]); return true; },
    async createAlbumAsync() { throw new Error('should use existing album'); },
    async getAssetsAsync() { throw new Error('iOS add-only users cannot query the library'); },
  };
  const uri = 'file:///cache/edited.jpg';
  assert.equal(await persistGalleryPhoto(uri, 'ios', library), '系统照片图库的「PinPic」相册');
  assert.equal(savedUri, uri);
  assert.deepEqual(calls, [['ph://saved-photo', 'existing-album']]);
});

test('iOS add-only permission still reports a successful photo-library save without album access', async () => {
  const library = {
    async createAssetAsync() { return { id: 'ph://saved-photo' }; },
    async createAlbumAsync() { throw new Error('not available with add-only permission'); },
    async getAssetsAsync() { throw new Error('iOS add-only users cannot query the library'); },
  };
  assert.equal(await persistGalleryPhoto('file:///cache/edited.jpg', 'ios', library), '系统照片图库');
});

test('write errors propagate instead of reporting success', async () => {
  const library = {
    async createAssetAsync() { throw new Error('write denied'); },
    async createAlbumAsync() { throw new Error('write denied'); },
    async getAssetsAsync() { return { assets: [] }; },
  };
  await assert.rejects(persistGalleryPhoto('file:///cache/fail.jpg', 'ios', library), /write denied/);
  await assert.rejects(persistGalleryPhoto('file:///cache/fail.jpg', 'android', library), /write denied/);
});
