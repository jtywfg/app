const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { test } = require('node:test');
const react = { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }), useId: () => 'test', useRef: (current) => ({ current }) };
const output = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/components/IDPhotoPortrait.tsx'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;
const exported = {};
vm.runInNewContext(output, { exports: exported, require(name) {
  if (name === 'react') return react;
  if (name === 'react-native') return { Image: 'Image', View: 'View', StyleSheet: { absoluteFill: {} } };
  if (name === '../lib/formalwear') return { getFormalwearTemplate: (id) => id === 'men-01' ? { source: 123, width: 600, height: 476 } : undefined };
  if (name === '../lib/idphotoSuitLayout') return { DEFAULT_SUIT_PLACEMENT: { x: 0, y: 0, scale: 1, rotation: 0 }, getRasterSuitRect: () => ({ x: -60, y: 265, width: 420, height: 250 }) };
  return {};
} });
test('raster garment and portrait must both load before allowing capture, in either load order', () => {
  for (const order of [[0, 1], [1, 0]]) {
    let ready = 0;
    const wrapper = exported.IDPhotoPortrait({ uri: 'file:///portrait.png', suit: 'men-01', width: 295, height: 413, onLoad: () => ready++ });
    const tree = wrapper.type(wrapper.props);
    const children = tree.props.children;
    children[order[0]].props.onLoad(); assert.equal(ready, 0);
    children[order[1]].props.onLoad(); assert.equal(ready, 1);
  }
});
test('plain portrait is ready after photo loads and raster clothing uses native Image callbacks', () => {
  let ready = 0; let errors = 0;
  const wrapper = exported.IDPhotoPortrait({ uri: 'file:///portrait.png', suit: 'none', width: 295, height: 413, onLoad: () => ready++ });
  wrapper.type(wrapper.props).props.children[0].props.onLoad(); assert.equal(ready, 1);
  const suit = exported.IDPhotoSuit({ styleId: 'men-01', width: 295, height: 413, onLoad: () => ready++, onError: () => errors++ });
  assert.equal(suit.props.children[0].type, 'Image');
  suit.props.children[0].props.onLoad(); assert.equal(ready, 2);
  suit.props.children[0].props.onError(); assert.equal(errors, 1);
});
