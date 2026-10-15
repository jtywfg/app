import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export function ActionGlyph({ kind, size = 28, color = '#FFFFFF' }: { kind: 'camera' | 'import'; size?: number; color?: string }) {
  return <Svg width={size} height={size} viewBox="0 0 28 28" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    {kind === 'camera' ? <><Path d="M3 8h5l2-3h8l2 3h5v16H3Z" /><Circle cx={14} cy={16} r={5} /><Circle cx={22} cy={11} r={0.7} fill={color} /></> : <><Rect x={3} y={7} width={18} height={17} rx={2} /><Path d="m5 21 5-6 4 4 3-3 4 4M20 3v10m-4-4 4 4 4-4" /><Circle cx={8} cy={11} r={1} /></>}
  </Svg>;
}
