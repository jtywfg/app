import React, { useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeTouchEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Chip } from '../components/Primitives';
import { applyCuts, getDividerSegments, getInternalCuts, moveCut, type Axis } from '../lib/adjustableLayout';
import { startCropGesture, updateCropGesture, type CropGestureStart, type PhotoPanZoom, type Point } from '../lib/cropGesture';
import { getLayoutOptions, getLayoutSlots, RATIO_OPTIONS } from '../lib/layouts';
import { saveViewToGallery } from '../lib/saveToGallery';
import { useStudio } from '../store/StudioContext';
import { colors } from '../theme';

const BACKGROUNDS = ['#FFFFFF', '#F5DDD4', '#DCEBFF', '#E8E1FF', '#E5F0DC', '#25252C'];
const FILTERS = [
  { name: '原图', tint: 'transparent' },
  { name: '奶油', tint: 'rgba(255, 191, 115, 0.20)' },
  { name: '冷调', tint: 'rgba(104, 168, 255, 0.19)' },
  { name: '复古', tint: 'rgba(127, 77, 43, 0.24)' },
  { name: '清透', tint: 'rgba(221, 244, 250, 0.20)' },
];
const TOOL_ITEMS = [
  { id: 'layout', label: '布局', icon: '▦' },
  { id: 'ratio', label: '比例', icon: '▣' },
  { id: 'frame', label: '画框', icon: '▢' },
  { id: 'background', label: '背景', icon: '◩' },
  { id: 'filter', label: '滤镜', icon: '◉' },
  { id: 'texture', label: '纹理', icon: '◌' },
] as const;

type ToolId = (typeof TOOL_ITEMS)[number]['id'];
type CellGesture = { index: number; start: CropGestureStart; width: number; height: number };
type DividerGesture = { axis: Axis; index: number; pagePosition: number; baseCuts: number[]; xCuts: number[]; yCuts: number[] };

function touchPoints(event: NativeSyntheticEvent<NativeTouchEvent>): Point[] {
  const touches = event.nativeEvent.touches.length ? event.nativeEvent.touches : event.nativeEvent.changedTouches;
  return touches.slice(0, 2).map((touch) => ({ pageX: touch.pageX, pageY: touch.pageY }));
}

function TexturePattern({ texture }: { texture: string }) {
  if (texture === '无') return null;
  const mark = texture === '点点' ? '·   ·   ·   ·   ·   ·   ·\n  ·   ·   ·   ·   ·   ·\n·   ·   ·   ·   ·   ·   ·' : '╱   ╱   ╱   ╱   ╱   ╱   ╱\n  ╱   ╱   ╱   ╱   ╱   ╱';
  return (
    <View pointerEvents="none" style={styles.textureOverlay}>
      <Text style={styles.textureText}>{mark}</Text>
    </View>
  );
}

export default function CollageEditorScreen() {
  const router = useRouter();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { photos, ratio, setRatio, layoutId, setLayoutId } = useStudio();
  const [activeTool, setActiveTool] = useState<ToolId>('layout');
  const [panelVisible, setPanelVisible] = useState(false);
  const [background, setBackground] = useState(BACKGROUNDS[0]);
  const [filter, setFilter] = useState(FILTERS[0]);
  const [texture, setTexture] = useState('无');
  const [gutter, setGutter] = useState(6);
  const [frameWidth, setFrameWidth] = useState(0);
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef<View>(null);

  const canvasWidth = useMemo(
    () => Math.min(screenWidth - 32, Math.max(160, (screenHeight * 0.43) * ratio)),
    [ratio, screenHeight, screenWidth]
  );
  const canvasHeight = canvasWidth / ratio;
  const baseSlots = getLayoutSlots(layoutId, photos.length);
  const layoutKey = `${layoutId}:${photos.length}`;
  const baseXCuts = getInternalCuts(baseSlots, 'x');
  const baseYCuts = getInternalCuts(baseSlots, 'y');
  const [cutState, setCutState] = useState<{ key: string; xCuts: number[]; yCuts: number[] } | null>(null);
  const xCuts = cutState?.key === layoutKey ? cutState.xCuts : baseXCuts;
  const yCuts = cutState?.key === layoutKey ? cutState.yCuts : baseYCuts;
  const slots = applyCuts(baseSlots, baseXCuts, xCuts, baseYCuts, yCuts);
  const [photoTransforms, setPhotoTransforms] = useState<Record<number, PhotoPanZoom>>({});
  const cellGesture = useRef<CellGesture | null>(null);
  const dividerGesture = useRef<DividerGesture | null>(null);
  const dividerSegments = getDividerSegments(slots);

  const startCellGesture = (index: number, slotWidth: number, slotHeight: number, event: NativeSyntheticEvent<NativeTouchEvent>) => {
    const points = touchPoints(event);
    if (!points.length) return;
    const photo = photoTransforms[index] ?? { x: 0, y: 0, scale: 1 };
    const asset = photos[index % photos.length];
    const fitScale = Math.max(slotWidth / Math.max(1, asset.width), slotHeight / Math.max(1, asset.height));
    const overflowX = (asset.width * fitScale / slotWidth - 1) / 2;
    const overflowY = (asset.height * fitScale / slotHeight - 1) / 2;
    cellGesture.current = { index, start: startCropGesture(photo, points, overflowX, overflowY), width: slotWidth, height: slotHeight };
  };

  const moveCellGesture = (index: number, event: NativeSyntheticEvent<NativeTouchEvent>) => {
    const gesture = cellGesture.current;
    const points = touchPoints(event);
    if (!gesture || gesture.index !== index || !points.length) return;
    if (points.length !== gesture.start.points) {
      startCellGesture(index, gesture.width, gesture.height, event);
      return;
    }
    const next = updateCropGesture(gesture.start, points, gesture.width, gesture.height);
    setPhotoTransforms((current) => ({ ...current, [index]: next }));
  };

  const startDivider = (axis: Axis, index: number, event: NativeSyntheticEvent<NativeTouchEvent>) => {
    const point = event.nativeEvent;
    dividerGesture.current = {
      axis,
      index,
      pagePosition: axis === 'x' ? point.pageX : point.pageY,
      baseCuts: axis === 'x' ? [...xCuts] : [...yCuts],
      xCuts: [...xCuts],
      yCuts: [...yCuts],
    };
  };

  const moveDivider = (event: NativeSyntheticEvent<NativeTouchEvent>) => {
    const gesture = dividerGesture.current;
    if (!gesture) return;
    const point = event.nativeEvent;
    const position = gesture.axis === 'x' ? point.pageX : point.pageY;
    const delta = (position - gesture.pagePosition) / (gesture.axis === 'x' ? canvasWidth : canvasHeight);
    const next = moveCut(gesture.baseCuts, gesture.index, delta);
    setCutState({
      key: layoutKey,
      xCuts: gesture.axis === 'x' ? next : gesture.xCuts,
      yCuts: gesture.axis === 'y' ? next : gesture.yCuts,
    });
  };

  if (photos.length < 2) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Text style={styles.empty}>请先选择拼图照片。</Text>
      </SafeAreaView>
    );
  }

  const selectTool = (tool: ToolId) => {
    setActiveTool(tool);
    setPanelVisible((wasVisible) => (activeTool === tool ? !wasVisible : true));
  };

  const save = async () => {
    try {
      await saveViewToGallery(canvasRef.current, ratio, setSaving);
    } catch (error) {
      Alert.alert('保存失败', error instanceof Error ? error.message : '请稍后重试。');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerButton} accessibilityLabel="返回">
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>拼图编辑</Text>
        <Pressable onPress={() => void save()} disabled={saving} style={styles.saveButton}>
          <Text style={styles.saveText}>{saving ? '保存中' : '保存'}</Text>
        </Pressable>
      </View>

      <View style={styles.canvasArea}>
        <View
          ref={canvasRef}
          collapsable={false}
          style={{ width: canvasWidth, height: canvasHeight, backgroundColor: background, overflow: 'hidden' }}
        >
          {slots.map((slot, index) => {
            const inset = gutter / 2;
            const cellWidth = Math.max(12, slot.width * canvasWidth - gutter);
            const cellHeight = Math.max(12, slot.height * canvasHeight - gutter);
            const photo = photoTransforms[index] ?? { x: 0, y: 0, scale: 1 };
            const asset = photos[index % photos.length];
            const fitScale = Math.max(cellWidth / Math.max(1, asset.width), cellHeight / Math.max(1, asset.height));
            const imageWidth = asset.width * fitScale * photo.scale;
            const imageHeight = asset.height * fitScale * photo.scale;
            return (
              <View
                key={`slot-${index}`}
                onStartShouldSetResponder={() => true}
                onMoveShouldSetResponder={() => true}
                onResponderTerminationRequest={() => false}
                onResponderGrant={(event) => startCellGesture(index, cellWidth, cellHeight, event)}
                onResponderStart={(event) => startCellGesture(index, cellWidth, cellHeight, event)}
                onResponderMove={(event) => moveCellGesture(index, event)}
                onResponderEnd={(event) => {
                  if (event.nativeEvent.touches.length) startCellGesture(index, cellWidth, cellHeight, event);
                  else cellGesture.current = null;
                }}
                onResponderRelease={() => { cellGesture.current = null; }}
                onResponderTerminate={() => { cellGesture.current = null; }}
                style={{
                  position: 'absolute',
                  left: slot.x * canvasWidth + inset,
                  top: slot.y * canvasHeight + inset,
                  width: cellWidth,
                  height: cellHeight,
                  borderWidth: frameWidth,
                  borderColor: '#FFFFFF',
                  overflow: 'hidden',
                  backgroundColor: '#FFFFFF',
                }}
              >
                <Image
                  source={{ uri: photos[index % photos.length].uri }}
                  resizeMode="cover"
                  style={{
                    position: 'absolute',
                    left: (cellWidth - imageWidth) / 2 + cellWidth * photo.x,
                    top: (cellHeight - imageHeight) / 2 + cellHeight * photo.y,
                    width: imageWidth,
                    height: imageHeight,
                  }}
                />
                {filter.tint !== 'transparent' ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: filter.tint }]} /> : null}
              </View>
            );
          })}
          {!saving ? dividerSegments.map((segment) => (
            <View
              key={`${segment.axis}-${segment.index}-${segment.start.toFixed(3)}`}
              onStartShouldSetResponder={() => true}
              onMoveShouldSetResponder={() => true}
              onResponderTerminationRequest={() => false}
              onResponderGrant={(event) => startDivider(segment.axis, segment.index, event)}
              onResponderMove={moveDivider}
              onResponderRelease={() => { dividerGesture.current = null; }}
              onResponderTerminate={() => { dividerGesture.current = null; }}
              style={segment.axis === 'x'
                ? { position: 'absolute', zIndex: 20, left: segment.value * canvasWidth - 14, top: segment.start * canvasHeight, width: 28, height: (segment.end - segment.start) * canvasHeight }
                : { position: 'absolute', zIndex: 20, left: segment.start * canvasWidth, top: segment.value * canvasHeight - 14, width: (segment.end - segment.start) * canvasWidth, height: 28 }}
            >
              <View pointerEvents="none" style={[styles.dividerGrip, segment.axis === 'x' ? styles.dividerGripVertical : styles.dividerGripHorizontal]} />
            </View>
          )) : null}
          <TexturePattern texture={texture} />
        </View>
      </View>

      <Text style={styles.gestureHint}>拖动照片调整取景 · 拖动分隔线调整区域</Text>

      {panelVisible ? (
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>{TOOL_ITEMS.find((item) => item.id === activeTool)?.label}</Text>
            <Pressable onPress={() => setPanelVisible(false)}><Text style={styles.panelClose}>完成</Text></Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.panelItems}>
            {activeTool === 'layout' ? getLayoutOptions(photos.length).map((option) => (
              <Pressable key={option.id} style={[styles.layoutChoice, layoutId === option.id && styles.layoutChoiceActive]} onPress={() => setLayoutId(option.id)}>
                <Text style={[styles.layoutChoiceText, layoutId === option.id && styles.layoutChoiceTextActive]}>{option.name}</Text>
              </Pressable>
            )) : null}
            {activeTool === 'ratio' ? RATIO_OPTIONS.map((option) => (
              <Chip key={option.label} label={option.label} selected={ratio === option.value} onPress={() => setRatio(option.value)} />
            )) : null}
            {activeTool === 'frame' ? [0, 4, 8, 12].map((value) => (
              <Chip key={value} label={value === 0 ? '无边框' : `${value}px`} selected={frameWidth === value} onPress={() => { setFrameWidth(value); setGutter(Math.max(4, value + 2)); }} />
            )) : null}
            {activeTool === 'background' ? BACKGROUNDS.map((value) => (
              <Pressable key={value} onPress={() => setBackground(value)} style={[styles.colorSwatch, { backgroundColor: value }, background === value && styles.colorSwatchSelected]} />
            )) : null}
            {activeTool === 'filter' ? FILTERS.map((value) => (
              <Pressable key={value.name} onPress={() => setFilter(value)} style={[styles.filterChoice, filter.name === value.name && styles.filterChoiceActive]}>
                <Text style={[styles.filterChoiceText, filter.name === value.name && styles.filterChoiceTextActive]}>{value.name}</Text>
              </Pressable>
            )) : null}
            {activeTool === 'texture' ? ['无', '点点', '斜纹'].map((value) => (
              <Pressable key={value} onPress={() => setTexture(value)} style={[styles.filterChoice, texture === value && styles.filterChoiceActive]}>
                <Text style={[styles.filterChoiceText, texture === value && styles.filterChoiceTextActive]}>{value}</Text>
              </Pressable>
            )) : null}
            {activeTool === 'frame' ? [0, 6, 12, 18].map((value) => (
              <Chip key={`gap-${value}`} label={`间距 ${value}`} selected={gutter === value} onPress={() => setGutter(value)} />
            )) : null}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.toolbar}>
        {TOOL_ITEMS.map((tool) => (
          <Pressable key={tool.id} style={styles.toolItem} onPress={() => selectTool(tool.id)}>
            <Text style={[styles.toolIcon, activeTool === tool.id && styles.toolIconActive]}>{tool.icon}</Text>
            <Text style={[styles.toolLabel, activeTool === tool.id && styles.toolLabelActive]}>{tool.label}</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.editor },
  header: { minHeight: 58, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerButton: { width: 54, height: 48, justifyContent: 'center' },
  back: { color: '#FFFFFF', fontSize: 38, lineHeight: 42, marginTop: -5 },
  headerTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  saveButton: { minWidth: 74, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#837AFB' },
  saveText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  canvasArea: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  gestureHint: { color: '#AAA6B4', textAlign: 'center', fontSize: 11, paddingVertical: 4 },
  dividerGrip: { position: 'absolute', left: '50%', top: '50%', borderRadius: 99, backgroundColor: '#9A8AFF', borderWidth: 2, borderColor: '#FFFFFF', shadowColor: '#000000', shadowOpacity: 0.38, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 5 },
  dividerGripVertical: { width: 40, height: 9, marginLeft: -20, marginTop: -4.5 },
  dividerGripHorizontal: { width: 9, height: 40, marginLeft: -4.5, marginTop: -20 },
  empty: { color: '#FFFFFF', padding: 20 },
  toolbar: { minHeight: 82, paddingHorizontal: 9, paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.editor },
  toolItem: { flex: 1, alignItems: 'center', gap: 5 },
  toolIcon: { color: '#F0EFF4', fontSize: 25, lineHeight: 30 },
  toolIconActive: { color: '#AA9FFF' },
  toolLabel: { color: '#D3D1D9', fontSize: 10 },
  toolLabelActive: { color: '#AA9FFF' },
  panel: { paddingTop: 11, paddingBottom: 9, backgroundColor: colors.editorPanel, borderTopWidth: 1, borderColor: '#37373E' },
  panelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 17, paddingBottom: 9 },
  panelTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  panelClose: { color: '#AAA1FF', fontSize: 12, fontWeight: '700' },
  panelItems: { alignItems: 'center', gap: 9, paddingHorizontal: 15, minHeight: 42 },
  layoutChoice: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 12, backgroundColor: '#3B3A43' },
  layoutChoiceActive: { backgroundColor: colors.violet },
  layoutChoiceText: { color: '#E2E0E8', fontSize: 12, fontWeight: '600' },
  layoutChoiceTextActive: { color: '#FFFFFF' },
  colorSwatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: '#5C5A63' },
  colorSwatchSelected: { borderWidth: 3, borderColor: '#A69BFF' },
  filterChoice: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: '#3B3A43' },
  filterChoiceActive: { backgroundColor: colors.violet },
  filterChoiceText: { color: '#E2E0E8', fontSize: 12, fontWeight: '600' },
  filterChoiceTextActive: { color: '#FFFFFF' },
  textureOverlay: { ...StyleSheet.absoluteFill, overflow: 'hidden', justifyContent: 'center', padding: 4 },
  textureText: { color: '#FFFFFF', fontSize: 23, lineHeight: 43, opacity: 0.12, fontWeight: '700' },
});
