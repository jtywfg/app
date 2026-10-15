import React, { useRef, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type GestureResponderEvent } from 'react-native';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { PhotoAsset } from '../types';
import { Chip } from './Primitives';

type Rect = { x: number; y: number; width: number; height: number };
export function CropEditor({ photo, onApply, onCancel }: { photo: PhotoAsset; onApply: (photo: PhotoAsset) => void; onCancel: () => void }) {
  const screen = useWindowDimensions();
  const width = Math.min(screen.width - 36, screen.height * 0.58 * photo.width / photo.height);
  const height = width * photo.height / photo.width;
  const [rect, setRect] = useState<Rect>({ x: 0, y: 0, width, height });
  const [ratio, setRatio] = useState(0);
  const [busy, setBusy] = useState(false);
  const origin = useRef<{ rect: Rect; pageX: number; pageY: number } | null>(null);
  const begin = (event: GestureResponderEvent) => { origin.current = { rect, pageX: event.nativeEvent.pageX, pageY: event.nativeEvent.pageY }; };
  const move = (kind: string, event: GestureResponderEvent) => {
    const start = origin.current;
    if (!start) return;
    const dx = event.nativeEvent.pageX - start.pageX;
    const dy = event.nativeEvent.pageY - start.pageY;
    const r = start.rect;
    if (kind === 'move') { setRect({ ...r, x: Math.max(0, Math.min(width - r.width, r.x + dx)), y: Math.max(0, Math.min(height - r.height, r.y + dy)) }); return; }
    let left = r.x, right = r.x + r.width, top = r.y, bottom = r.y + r.height;
    if (kind.includes('l')) left = Math.max(0, Math.min(right - 32, left + dx));
    if (kind.includes('r')) right = Math.min(width, Math.max(left + 32, right + dx));
    if (kind.includes('t')) top = Math.max(0, Math.min(bottom - 32, top + dy));
    if (kind.includes('b')) bottom = Math.min(height, Math.max(top + 32, bottom + dy));
    let w = right - left, h = bottom - top;
    if (ratio) {
      if (kind === 't' || kind === 'b') w = h * ratio; else h = w / ratio;
      w = Math.min(w, width); h = w / ratio;
      if (h > height) { h = height; w = h * ratio; }
      left = kind.includes('l') ? r.x + r.width - w : left;
      top = kind.includes('t') ? r.y + r.height - h : top;
    }
    setRect({ x: Math.max(0, Math.min(width - w, left)), y: Math.max(0, Math.min(height - h, top)), width: w, height: h });
  };
  const apply = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const scale = photo.width / width;
      const x = Math.round(rect.x * scale), y = Math.round(rect.y * scale);
      const context = ImageManipulator.manipulate(photo.uri);
      context.crop({ originX: x, originY: y, width: Math.min(photo.width - x, Math.max(1, Math.round(rect.width * scale))), height: Math.min(photo.height - y, Math.max(1, Math.round(rect.height * scale))) });
      const rendered = await context.renderAsync();
      const output = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 1 });
      onApply(output);
    } catch (cause) { Alert.alert('裁剪失败', cause instanceof Error ? cause.message : '请重试'); }
    finally { setBusy(false); }
  };
  const handles = [{ kind: 'tl', x: 0, y: 0 }, { kind: 't', x: 0.5, y: 0 }, { kind: 'tr', x: 1, y: 0 }, { kind: 'l', x: 0, y: 0.5 }, { kind: 'r', x: 1, y: 0.5 }, { kind: 'bl', x: 0, y: 1 }, { kind: 'b', x: 0.5, y: 1 }, { kind: 'br', x: 1, y: 1 }];
  return <View style={styles.screen}>
    <Text style={styles.hint}>拖动边缘或角点调整范围 · 拖动框内移动</Text>
    <View style={styles.area}><View style={{ width, height }}><Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={[styles.shade, { left: 0, top: 0, width, height: rect.y }]} />
      <View pointerEvents="none" style={[styles.shade, { left: 0, top: rect.y + rect.height, width, height: height - rect.y - rect.height }]} />
      <View pointerEvents="none" style={[styles.shade, { left: 0, top: rect.y, width: rect.x, height: rect.height }]} />
      <View pointerEvents="none" style={[styles.shade, { left: rect.x + rect.width, top: rect.y, width: width - rect.x - rect.width, height: rect.height }]} />
      <View onStartShouldSetResponder={() => true} onResponderGrant={begin} onResponderMove={(event) => move('move', event)} style={[styles.rect, { left: rect.x, top: rect.y, width: rect.width, height: rect.height }]}>
        {[1, 2].map((i) => <React.Fragment key={i}><View pointerEvents="none" style={[styles.grid, { left: `${i * 100 / 3}%`, top: 0, bottom: 0, width: 1 }]} /><View pointerEvents="none" style={[styles.grid, { top: `${i * 100 / 3}%`, left: 0, right: 0, height: 1 }]} /></React.Fragment>)}
      </View>
      {handles.map((handle) => <View key={handle.kind} accessibilityLabel={`裁剪${handle.kind}`} onStartShouldSetResponder={() => true} onResponderGrant={begin} onResponderMove={(event) => move(handle.kind, event)} style={[styles.handle, { left: rect.x + handle.x * rect.width - 18, top: rect.y + handle.y * rect.height - 18 }]}><View style={styles.dot} /></View>)}
    </View></View>
    <View style={styles.actions}><Pressable disabled={busy} onPress={onCancel}><Text style={styles.action}>取消</Text></Pressable><Pressable disabled={busy} onPress={() => void apply()}><Text style={styles.action}>{busy ? '裁剪中…' : '确认裁剪 ✓'}</Text></Pressable></View>
    <ScrollView horizontal style={styles.ratios} contentContainerStyle={{ gap: 8, paddingHorizontal: 15 }}>{[{ label: 'Free', value: 0 }, { label: '1:1', value: 1 }, { label: '4:5', value: 0.8 }, { label: '2:1', value: 2 }, { label: '3:4', value: 0.75 }].map((option) => <Chip key={option.label} label={option.label} selected={ratio === option.value} onPress={() => { setRatio(option.value); const w = option.value ? Math.min(width, height * option.value) : width; const h = option.value ? w / option.value : height; setRect({ x: (width - w) / 2, y: (height - h) / 2, width: w, height: h }); }} />)}</ScrollView>
  </View>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, hint: { color: '#aaa', textAlign: 'center', fontSize: 11, padding: 10 }, area: { flex: 1, alignItems: 'center', justifyContent: 'center' }, shade: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.55)' }, rect: { position: 'absolute', borderWidth: 1, borderColor: '#fff' }, grid: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.5)' }, handle: { position: 'absolute', width: 36, height: 36, justifyContent: 'center', alignItems: 'center' }, dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff' }, actions: { flexDirection: 'row', justifyContent: 'space-between', padding: 18 }, action: { color: '#fff', fontSize: 16 }, ratios: { maxHeight: 60 } });
