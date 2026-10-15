const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

function harness(width = 300, height = 420) {
  const source = fs.readFileSync(path.join(__dirname, '../src/components/SuitGestureLayer.tsx'), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, require(name) {
    if (name === 'react') return { useRef: (value) => ({ current: value }) };
    if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ props }) };
    if (name === 'react-native') return { View: 'View', StyleSheet: { absoluteFill: {} } };
    throw new Error(`Unexpected runtime dependency: ${name}`);
  } });
  const values = [];
  const { props } = exports.SuitGestureLayer({ width, height, placement: { x: 0, y: 0, scale: 1, rotation: 0 }, onChange: (value) => values.push(value) });
  const event = (...pairs) => ({ nativeEvent: { touches: pairs.map(([pageX, pageY]) => ({ pageX, pageY })) } });
  return { props, values, event };
}

test('dragging the garment changes position without scaling or rotating it', () => {
  const { props, values, event } = harness();
  props.onResponderGrant(event([30, 40]));
  props.onResponderMove(event([60, 82]));
  assert.equal(values[0].x, 0.1);
  assert.equal(values[0].y, 0.1);
  assert.equal(values[0].scale, 1);
  assert.equal(values[0].rotation, 0);
  props.onResponderRelease();
  props.onResponderMove(event([90, 100]));
  assert.equal(values.length, 1);
});

test('two-finger garment fitting scales and rotates with sensible bounds', () => {
  const { props, values, event } = harness();
  props.onResponderGrant(event([100, 100], [200, 100]));
  props.onResponderMove(event([50, 100], [250, 100]));
  assert.equal(values[0].scale, 2);
  assert.equal(values[0].x, 0);
  props.onResponderMove(event([150, 0], [150, 300]));
  assert.equal(values[1].scale, 2.2);
  assert.equal(values[1].rotation, 25);
});

test('gesture displacement remains the same proportion at a smaller preview size', () => {
  const { props, values, event } = harness(150, 210);
  props.onResponderGrant(event([0, 0]));
  props.onResponderMove(event([15, 21]));
  assert.equal(values[0].x, 0.1);
  assert.equal(values[0].y, 0.1);
});
