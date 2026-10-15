import React, { useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export type PhotoLayer = { id: string; kind: 'text' | 'sticker'; value: string; x: number; y: number };
export function MovableLayer({ layer, width, height, selected, onSelect, onMove, clean }: { layer: PhotoLayer; width: number; height: number; selected: boolean; onSelect: () => void; onMove: (x: number, y: number) => void; clean: boolean }) {
  const origin = useRef({ x: 0, y: 0, pageX: 0, pageY: 0 });
  const size = useRef({ width: 50, height: 45 });
  return <View onLayout={(event) => { size.current = event.nativeEvent.layout; }} onStartShouldSetResponder={() => !clean} onResponderGrant={(event) => { onSelect(); origin.current = { x: layer.x * width, y: layer.y * height, pageX: event.nativeEvent.pageX, pageY: event.nativeEvent.pageY }; }} onResponderMove={(event) => { const start = origin.current; onMove(Math.max(0, Math.min(width - size.current.width, start.x + event.nativeEvent.pageX - start.pageX)) / width, Math.max(0, Math.min(height - size.current.height, start.y + event.nativeEvent.pageY - start.pageY)) / height); }} style={[styles.layer, { left: layer.x * width, top: layer.y * height, maxWidth: width, borderColor: selected && !clean ? '#b5a9ff' : 'transparent' }]}><Text style={layer.kind === 'text' ? styles.text : styles.sticker}>{layer.value}</Text></View>;
}
const styles = StyleSheet.create({ layer: { position: 'absolute', borderWidth: 1, padding: 5 }, text: { color: '#fff', fontSize: 23, fontWeight: '800', textShadowColor: '#333', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 3 }, sticker: { fontSize: 34 } });
