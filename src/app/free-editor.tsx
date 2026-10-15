import React, { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeTouchEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Chip } from '../components/Primitives';
import { RATIO_OPTIONS } from '../lib/layouts';
import { startGesture, updateGesture, type GestureStart, type Point } from '../lib/freeTransform';
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
const TOOLS = [
  { id: 'ratio', label: '比例', icon: '▣' },
  { id: 'adjust', label: '调整', icon: '☷' },
  { id: 'filter', label: '滤镜', icon: '◉' },
  { id: 'texture', label: '纹理', icon: '◌' },
  { id: 'background', label: '背景', icon: '◩' },
  { id: 'text', label: '文字', icon: 'T' },
] as const;

type ToolId = (typeof TOOLS)[number]['id'];
type FreeItem = { x: number; y: number; scale: number; rotation: number };
type ActiveGesture = { index: number; start: GestureStart; itemWidth: number; itemHeight: number };

function touchPoints(event: NativeSyntheticEvent<NativeTouchEvent>): Point[] {
  const touches = event.nativeEvent.touches.length ? event.nativeEvent.touches : event.nativeEvent.changedTouches;
  return touches.slice(0, 2).map((touch) => ({ pageX: touch.pageX, pageY: touch.pageY }));
}

function makeItems(count: number, width: number, height: number): FreeItem[] {
  const columns = count <= 4 ? 2 : 3;
  const rows = Math.ceil(count / columns);
  const itemWidth = Math.min(148, (width - 24) / columns - 8);
  const itemHeight = itemWidth * 1.08;
  const usableHeight = Math.max(0, height - itemHeight - 36);
  return Array.from({ length: count }, (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = 12 + column * Math.max(0, width - itemWidth - 24) / Math.max(1, columns - 1);
    const y = 18 + row * usableHeight / Math.max(1, rows - 1);
    return {
      x,
      y,
      scale: count <= 2 ? 0.92 : 0.76,
      rotation: index % 2 === 0 ? -5 : 6,
    };
  });
}

export default function FreeEditorScreen() {
  const router = useRouter();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { photos, ratio, setRatio } = useStudio();
  const canvasWidth = Math.min(screenWidth - 32, screenHeight * 0.42 * ratio);
  const canvasHeight = canvasWidth / ratio;
  const itemLayoutKey = `${photos.length}:${canvasWidth.toFixed(1)}:${canvasHeight.toFixed(1)}`;
  const defaultItems = useMemo(() => makeItems(photos.length, canvasWidth, canvasHeight), [photos.length, canvasWidth, canvasHeight]);
  const [itemState, setItemState] = useState<{ key: string; items: FreeItem[] } | null>(null);
  const items = itemState?.key === itemLayoutKey ? itemState.items : defaultItems;
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeTool, setActiveTool] = useState<ToolId>('adjust');
  const [panelVisible, setPanelVisible] = useState(true);
  const [background, setBackground] = useState(BACKGROUNDS[0]);
  const [filter, setFilter] = useState(FILTERS[0]);
  const [texture, setTexture] = useState('无');
  const [caption, setCaption] = useState('');
  const [textDraft, setTextDraft] = useState('');
  const [textModalVisible, setTextModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasStarted, setHasStarted] = useState(true);
  const canvasRef = React.useRef<View>(null);
  const itemGesture = React.useRef<ActiveGesture | null>(null);

  const updateItems = (update: (current: FreeItem[]) => FreeItem[]) => {
    setItemState((currentState) => {
      const current = currentState?.key === itemLayoutKey ? currentState.items : defaultItems;
      return { key: itemLayoutKey, items: update(current) };
    });
  };

  const startPhotoGesture = (index: number, event: NativeSyntheticEvent<NativeTouchEvent>) => {
    const item = items[index];
    const points = touchPoints(event);
    if (!item || !points.length) return;
    setActiveIndex(index);
    const columns = photos.length <= 4 ? 2 : 3;
    const itemWidth = Math.max(24, Math.min(148, (canvasWidth - 24) / columns - 8));
    const itemHeight = itemWidth * 1.08;
    itemGesture.current = { index, start: startGesture(item, points), itemWidth, itemHeight };
  };

  const onPhotoMove = (index: number, event: NativeSyntheticEvent<NativeTouchEvent>) => {
    const gesture = itemGesture.current;
    const points = touchPoints(event);
    if (!gesture || gesture.index !== index || !points.length) return;
    if (points.length !== gesture.start.points) {
      startPhotoGesture(index, event);
      return;
    }
    const next = updateGesture(gesture.start, points, canvasWidth, canvasHeight, gesture.itemWidth, gesture.itemHeight);
    updateItems((current) => current.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      return next;
    }));
  };

  const selectTool = (tool: ToolId) => {
    setActiveTool(tool);
    setPanelVisible((wasVisible) => (activeTool === tool ? !wasVisible : true));
    if (tool === 'text') {
      setTextDraft(caption);
      setTextModalVisible(true);
    }
  };

  const save = async () => {
    try {
      await saveViewToGallery(canvasRef.current, ratio, setSaving);
    } catch (error) {
      Alert.alert('保存失败', error instanceof Error ? error.message : '请稍后重试。');
    }
  };

  if (photos.length < 2) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Text style={styles.empty}>请先选择至少两张照片。</Text>
      </SafeAreaView>
    );
  }

  if (!hasStarted) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <StatusBar barStyle="light-content" />
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.headerButton} accessibilityLabel="返回">
            <Text style={styles.back}>‹</Text>
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>自由拼图</Text>
            <Text style={styles.headerCaption}>已选择 {photos.length} 张照片</Text>
          </View>
          <View style={styles.headerButton} />
        </View>
        <ScrollView contentContainerStyle={styles.selectedPhotos} showsVerticalScrollIndicator={false}>
          <Text style={styles.selectionTitle}>确认照片</Text>
          <Text style={styles.selectionCaption}>下一步可拖动、缩放和旋转每张照片</Text>
          <View style={styles.selectedPhotoGrid}>
            {photos.map((photo, index) => (
              <View key={`${photo.uri}-${index}`} style={styles.selectedPhotoWrap}>
                <Image source={{ uri: photo.uri }} resizeMode="cover" style={styles.selectedPhoto} />
                <Text style={styles.selectedPhotoNumber}>{index + 1}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
        <Pressable style={styles.nextButton} onPress={() => setHasStarted(true)}>
          <Text style={styles.nextButtonText}>下一步</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerButton} accessibilityLabel="返回"><Text style={styles.back}>‹</Text></Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>自由拼图</Text>
            <Text style={styles.headerCaption}>单指拖动 · 双指缩放旋转</Text>
        </View>
        <Pressable onPress={() => void save()} disabled={saving} style={styles.saveButton}><Text style={styles.saveText}>{saving ? '保存中' : '保存'}</Text></Pressable>
      </View>

      <View style={styles.canvasArea}>
        <View ref={canvasRef} collapsable={false} style={[styles.canvas, { width: canvasWidth, height: canvasHeight, backgroundColor: background }]}>
          {items.map((item, index) => {
            const itemWidth = Math.min(148, (canvasWidth - 24) / (photos.length <= 4 ? 2 : 3) - 8) * item.scale;
            const itemHeight = itemWidth * 1.08;
            return (
              <View
                key={`${photos[index].uri}-${index}`}
                onStartShouldSetResponder={() => true}
                onMoveShouldSetResponder={() => true}
                onResponderTerminationRequest={() => false}
                onResponderGrant={(event) => startPhotoGesture(index, event)}
                onResponderStart={(event) => startPhotoGesture(index, event)}
                onResponderMove={(event) => onPhotoMove(index, event)}
                onResponderEnd={(event) => {
                  if (event.nativeEvent.touches.length) startPhotoGesture(index, event);
                  else itemGesture.current = null;
                }}
                onResponderRelease={() => { itemGesture.current = null; }}
                onResponderTerminate={() => { itemGesture.current = null; }}
                style={[
                  styles.photoLayer,
                  {
                    left: item.x,
                    top: item.y,
                    width: itemWidth,
                    height: itemHeight,
                    transform: [{ rotate: `${item.rotation}deg` }],
                    zIndex: index === activeIndex ? 10 : index + 1,
                    borderColor: !saving && index === activeIndex ? '#B5A9FF' : '#FFFFFF',
                  },
                ]}
              >
                <Image source={{ uri: photos[index].uri }} resizeMode="cover" style={StyleSheet.absoluteFill} />
                {filter.tint !== 'transparent' ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: filter.tint }]} /> : null}
              </View>
            );
          })}
          {texture !== '无' ? (
            <View pointerEvents="none" style={styles.textureOverlay}>
              <Text style={styles.textureText}>{texture === '点点' ? '·  ·  ·  ·  ·  ·  ·  ·\n  ·  ·  ·  ·  ·  ·  ·' : '╱   ╱   ╱   ╱   ╱   ╱\n  ╱   ╱   ╱   ╱   ╱'}</Text>
            </View>
          ) : null}
          {caption ? <Text pointerEvents="none" style={styles.captionOverlay}>{caption}</Text> : null}
        </View>
      </View>

      {panelVisible ? (
        <View style={styles.panel}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.panelItems}>
            {activeTool === 'ratio' ? RATIO_OPTIONS.map((option) => (
              <Chip key={option.label} label={option.label} selected={ratio === option.value} onPress={() => setRatio(option.value)} />
            )) : null}
            {activeTool === 'adjust' ? (
              <View style={styles.adjustRow}>
                <Text style={styles.adjustLabel}>单指拖动 · 双指捏合缩放 · 双指旋转</Text>
                <Text style={styles.scaleLabel}>照片 {activeIndex + 1} · {Math.round((items[activeIndex]?.scale ?? 1) * 100)}%</Text>
              </View>
            ) : null}
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
            {activeTool === 'background' ? BACKGROUNDS.map((value) => (
              <Pressable key={value} onPress={() => setBackground(value)} style={[styles.colorSwatch, { backgroundColor: value }, background === value && styles.colorSwatchSelected]} />
            )) : null}
            {activeTool === 'text' ? <Text style={styles.textHint}>添加文字后会显示在画布底部</Text> : null}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.toolbar}>
        {TOOLS.map((tool) => (
          <Pressable key={tool.id} style={styles.toolItem} onPress={() => selectTool(tool.id)}>
            <Text style={[styles.toolIcon, activeTool === tool.id && styles.toolIconActive]}>{tool.icon}</Text>
            <Text style={[styles.toolLabel, activeTool === tool.id && styles.toolLabelActive]}>{tool.label}</Text>
          </Pressable>
        ))}
      </View>

      <Modal visible={textModalVisible} transparent animationType="fade" onRequestClose={() => setTextModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>添加文字</Text>
            <TextInput
              value={textDraft}
              onChangeText={setTextDraft}
              placeholder="写下这一刻…"
              placeholderTextColor="#9A96A4"
              style={styles.textInput}
              maxLength={40}
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setTextModalVisible(false)} style={styles.modalAction}><Text style={styles.modalCancel}>取消</Text></Pressable>
              <Pressable onPress={() => { setCaption(textDraft.trim()); setTextModalVisible(false); }} style={[styles.modalAction, styles.modalConfirm]}><Text style={styles.modalConfirmText}>应用</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.editor },
  header: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  headerButton: { width: 54, height: 48, justifyContent: 'center' },
  back: { color: '#FFFFFF', fontSize: 38, lineHeight: 42, marginTop: -5 },
  headerCenter: { alignItems: 'center', flex: 1 },
  headerTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  headerCaption: { color: '#AAA8B2', fontSize: 10, marginTop: 2 },
  saveButton: { minWidth: 74, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#837AFB' },
  saveText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  canvasArea: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  canvas: { overflow: 'hidden' },
  empty: { color: '#FFFFFF', padding: 20 },
  photoLayer: { position: 'absolute', overflow: 'hidden', borderWidth: 5, borderRadius: 4, backgroundColor: '#FFFFFF', shadowColor: '#000000', shadowOpacity: 0.24, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 7 },
  textureOverlay: { ...StyleSheet.absoluteFill, justifyContent: 'center', padding: 4 },
  textureText: { color: '#FFFFFF', fontSize: 22, lineHeight: 42, opacity: 0.14, fontWeight: '700' },
  captionOverlay: { position: 'absolute', bottom: 22, left: 12, right: 12, color: '#FFFFFF', fontSize: 22, fontWeight: '800', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.75)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
  panel: { minHeight: 59, justifyContent: 'center', backgroundColor: colors.editorPanel, borderTopWidth: 1, borderColor: '#37373E' },
  panelItems: { alignItems: 'center', gap: 9, paddingHorizontal: 14, paddingVertical: 9, minHeight: 56 },
  adjustRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  adjustLabel: { color: '#E6E3EC', fontSize: 11, marginRight: 3 },
  scaleLabel: { color: '#FFFFFF', fontSize: 11, minWidth: 35, textAlign: 'center' },
  filterChoice: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: '#3B3A43' },
  filterChoiceActive: { backgroundColor: colors.violet },
  filterChoiceText: { color: '#E2E0E8', fontSize: 12, fontWeight: '600' },
  filterChoiceTextActive: { color: '#FFFFFF' },
  colorSwatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: '#5C5A63' },
  colorSwatchSelected: { borderWidth: 3, borderColor: '#A69BFF' },
  textHint: { color: '#D5D2DC', fontSize: 12 },
  toolbar: { minHeight: 80, paddingHorizontal: 8, paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between' },
  toolItem: { flex: 1, alignItems: 'center', gap: 5 },
  toolIcon: { color: '#F0EFF4', fontSize: 25, lineHeight: 30 },
  toolIconActive: { color: '#AA9FFF' },
  toolLabel: { color: '#D3D1D9', fontSize: 10 },
  toolLabelActive: { color: '#AA9FFF' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 22 },
  modalCard: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 20, gap: 16 },
  modalTitle: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  textInput: { borderWidth: 1, borderColor: '#E5E1EE', borderRadius: 13, padding: 13, color: colors.ink, fontSize: 16 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  modalAction: { paddingHorizontal: 17, paddingVertical: 11, borderRadius: 12 },
  modalCancel: { color: colors.muted, fontWeight: '700' },
  modalConfirm: { backgroundColor: colors.violet },
  modalConfirmText: { color: '#FFFFFF', fontWeight: '700' },
  selectedPhotos: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 25 },
  selectionTitle: { color: '#FFFFFF', fontSize: 21, fontWeight: '800' },
  selectionCaption: { color: '#AAA8B2', fontSize: 12, marginTop: 5, marginBottom: 18 },
  selectedPhotoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  selectedPhotoWrap: { width: '30%', aspectRatio: 1, borderRadius: 13, overflow: 'hidden', backgroundColor: '#36343C' },
  selectedPhoto: { width: '100%', height: '100%' },
  selectedPhotoNumber: { position: 'absolute', left: 7, top: 7, width: 22, height: 22, textAlign: 'center', textAlignVertical: 'center', overflow: 'hidden', borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.54)', color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  nextButton: { minHeight: 51, marginHorizontal: 17, marginBottom: 8, borderRadius: 15, backgroundColor: colors.violet, alignItems: 'center', justifyContent: 'center' },
  nextButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
