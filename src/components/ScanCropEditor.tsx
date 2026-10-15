import React, { useRef, useState } from 'react';
import { Image, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import Svg, { Circle, Line, Path, Polygon } from 'react-native-svg';
import { moveScanHandle, scanContainRect, type ScanPoint, type ScanQuad } from '../lib/scannerGeometry';
import type { PhotoAsset } from '../types';

export function ScanCropEditor({ source, points, onChange }: { source: PhotoAsset; points: ScanQuad; onChange: (points: ScanQuad) => void }) {
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [active, setActive] = useState<number | null>(null);
  const drag = useRef<{ points: ScanQuad; handle: number; x: number; y: number } | null>(null);
  const rect = scanContainRect(Math.max(1, size.width - 24), Math.max(1, size.height - 24), source.width, source.height);
  rect.x += 12; rect.y += 12;
  const toScreen = (p: ScanPoint) => ({ x: rect.x + p.x * rect.width, y: rect.y + p.y * rect.height });
  const handles = [...points, ...points.map((p, i) => ({ x: (p.x + points[(i + 1) % 4].x) / 2, y: (p.y + points[(i + 1) % 4].y) / 2 }))].map(toScreen);
  const begin = (event: GestureResponderEvent) => {
    const { locationX: x, locationY: y, pageX, pageY } = event.nativeEvent;
    const handle = handles.reduce((best, p, i, all) => Math.hypot(p.x - x, p.y - y) < Math.hypot(all[best].x - x, all[best].y - y) ? i : best, 0);
    drag.current = { points: points.map((p) => ({ ...p })) as ScanQuad, handle, x: pageX, y: pageY }; setActive(handle);
  };
  const move = (event: GestureResponderEvent) => {
    const start = drag.current;
    if (start) onChange(moveScanHandle(start.points, start.handle, (event.nativeEvent.pageX - start.x) / rect.width, (event.nativeEvent.pageY - start.y) / rect.height));
  };
  const end = () => { drag.current = null; setActive(null); };
  const polygon = handles.slice(0, 4).map((p) => `${p.x},${p.y}`).join(' ');
  return <View style={styles.stage} onLayout={(e) => setSize(e.nativeEvent.layout)}
    onStartShouldSetResponder={(event) => handles.some((p) => Math.hypot(p.x - event.nativeEvent.locationX, p.y - event.nativeEvent.locationY) < 42)}
    onResponderGrant={begin} onResponderMove={move} onResponderRelease={end} onResponderTerminate={end} onResponderTerminationRequest={() => false}>
    <View pointerEvents="none" style={StyleSheet.absoluteFill}><Image source={{ uri: source.uri }} style={{ position: 'absolute', left: rect.x, top: rect.y, width: rect.width, height: rect.height }} /></View>
    <Svg pointerEvents="none" width={size.width} height={size.height}>
      <Path d={`M0 0H${size.width}V${size.height}H0Z M${handles.slice(0, 4).map((p) => `${p.x} ${p.y}`).join('L')}Z`} fill="#00000099" fillRule="evenodd" />
      <Polygon points={polygon} fill="transparent" stroke="#21D4BB" strokeWidth={2} />
      {handles.slice(0, 4).map((p, i) => <Circle key={i} cx={p.x} cy={p.y} r={active === i ? 11 : 8} fill="#FFFFFF" stroke="#21D4BB" strokeWidth={3} />)}
      {handles.slice(4).map((p, i) => <Line key={i} x1={p.x - (i % 2 === 0 ? 9 : 0)} y1={p.y - (i % 2 === 1 ? 9 : 0)} x2={p.x + (i % 2 === 0 ? 9 : 0)} y2={p.y + (i % 2 === 1 ? 9 : 0)} stroke={active === i + 4 ? '#FFFFFF' : '#21D4BB'} strokeWidth={9} strokeLinecap="round" />)}
    </Svg>
    {active !== null ? <View pointerEvents="none" style={styles.magnifier}><Image source={{ uri: source.uri }} style={{ position: 'absolute', width: rect.width * 2.5, height: rect.height * 2.5, left: 50 - (handles[active].x - rect.x) * 2.5, top: 50 - (handles[active].y - rect.y) * 2.5 }} /><View style={styles.cross} /><Text style={styles.plus}>＋</Text></View> : null}
  </View>;
}
const styles = StyleSheet.create({ stage: { flex: 1, backgroundColor: '#080A0D' }, magnifier: { position: 'absolute', top: 6, left: 10, width: 100, height: 100, borderRadius: 50, overflow: 'hidden', borderWidth: 2, borderColor: '#21D4BB', backgroundColor: '#111' }, cross: { ...StyleSheet.absoluteFill, borderRadius: 50, borderWidth: 1, borderColor: '#FFFFFF77' }, plus: { position: 'absolute', left: 38, top: 35, fontSize: 24, color: '#21D4BB' } });
