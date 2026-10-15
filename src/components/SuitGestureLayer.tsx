import React, { useRef } from 'react';
import { StyleSheet, View, type NativeSyntheticEvent, type NativeTouchEvent } from 'react-native';
import type { SuitPlacement } from '../lib/idphotoSuitLayout';

type Touch = { pageX: number; pageY: number };
const center = (points: Touch[]) => points.length === 2 ? { pageX: (points[0].pageX + points[1].pageX) / 2, pageY: (points[0].pageY + points[1].pageY) / 2 } : points[0];
const distance = (points: Touch[]) => points.length === 2 ? Math.hypot(points[1].pageX - points[0].pageX, points[1].pageY - points[0].pageY) : 1;
const angle = (points: Touch[]) => points.length === 2 ? Math.atan2(points[1].pageY - points[0].pageY, points[1].pageX - points[0].pageX) : 0;
const touches = (event: NativeSyntheticEvent<NativeTouchEvent>) => event.nativeEvent.touches.slice(0, 2);

export function SuitGestureLayer({ width, height, placement, onChange }: { width: number; height: number; placement: SuitPlacement; onChange: (value: SuitPlacement) => void }) {
  const active = useRef<{ placement: SuitPlacement; points: Touch[] } | null>(null);
  const begin = (event: NativeSyntheticEvent<NativeTouchEvent>) => {
    const points = touches(event);
    if (points.length) active.current = { placement, points };
  };
  const move = (event: NativeSyntheticEvent<NativeTouchEvent>) => {
    const points = touches(event);
    const start = active.current;
    if (!start || !points.length) return;
    if (points.length !== start.points.length) { begin(event); return; }
    const from = center(start.points);
    const to = center(points);
    let delta = angle(points) - angle(start.points);
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    onChange({
      x: Math.max(-0.45, Math.min(0.45, start.placement.x + (to.pageX - from.pageX) / width)),
      y: Math.max(-0.45, Math.min(0.45, start.placement.y + (to.pageY - from.pageY) / height)),
      scale: points.length === 2 ? Math.max(0.65, Math.min(2.2, start.placement.scale * distance(points) / Math.max(1, distance(start.points)))) : start.placement.scale,
      rotation: points.length === 2 ? Math.max(-25, Math.min(25, start.placement.rotation + delta * 180 / Math.PI)) : start.placement.rotation,
    });
  };
  return <View style={StyleSheet.absoluteFill} accessibilityLabel="单指移动正装，双指缩放或旋转"
    onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true}
    onResponderTerminationRequest={() => false} onResponderGrant={begin} onResponderStart={begin}
    onResponderMove={move} onResponderEnd={(event) => { if (touches(event).length) begin(event); else active.current = null; }}
    onResponderRelease={() => { active.current = null; }} onResponderTerminate={() => { active.current = null; }} />;
}
