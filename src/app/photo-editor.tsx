import React, { useMemo, useRef, useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Chip } from '../components/Primitives';
import { saveViewToGallery } from '../lib/saveToGallery';
import { useStudio } from '../store/StudioContext';
import { colors } from '../theme';
import { CropEditor } from '../components/CropEditor';
import { MovableLayer, type PhotoLayer } from '../components/MovableLayer';
import type { PhotoAsset } from '../types';

const FILTERS = [
  { name: '原图', tint: 'transparent' },
  { name: '奶油', tint: 'rgba(255, 191, 115, 0.20)' },
  { name: '冷调', tint: 'rgba(104, 168, 255, 0.19)' },
  { name: '复古', tint: 'rgba(127, 77, 43, 0.24)' },
  { name: '清透', tint: 'rgba(221, 244, 250, 0.20)' },
];
const CROP_RATIOS = [
  { label: '原图', value: 0 },
  { label: '1:1', value: 1 },
  { label: '4:5', value: 4 / 5 },
  { label: '4:3', value: 4 / 3 },
  { label: '9:16', value: 9 / 16 },
];
const STICKERS = ['✨', '🤍', '🌸', '☀️', '🎀', '🫧', '🍓', '⭐️'];
const TOOLS = [
  { id: 'crop', label: '裁剪', icon: '⌗' },
  { id: 'filter', label: '滤镜', icon: '◉' },
  { id: 'adjust', label: '调整', icon: '☷' },
  { id: 'text', label: '文字', icon: 'T' },
  { id: 'sticker', label: '贴纸', icon: '✦' },
] as const;

type ToolId = (typeof TOOLS)[number]['id'];
let layerSerial = 0;
function nextLayerId() { return `layer-${++layerSerial}`; }

export default function PhotoEditorScreen() {
  const router = useRouter();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { photos } = useStudio();
  const [editedPhoto, setEditedPhoto] = useState<PhotoAsset | null>(null);
  const photo = editedPhoto ?? photos[0];
  const [cropping, setCropping] = useState(false);
  const [layers, setLayers] = useState<PhotoLayer[]>([]);
  const [selectedLayer, setSelectedLayer] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<ToolId>('adjust');
  const [panelVisible, setPanelVisible] = useState(true);
  const [cropRatio, setCropRatio] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [brightness, setBrightness] = useState(0);
  const [filter, setFilter] = useState(FILTERS[0]);
  const [textDraft, setTextDraft] = useState('');
  const [textModalVisible, setTextModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef<View>(null);
  const addLayer = (kind: PhotoLayer['kind'], value: string) => {
    const id = nextLayerId();
    setLayers((current) => [...current, { id, kind, value, x: 0.15, y: 0.2 }]);
    setSelectedLayer(id);
  };

  const originalRatio = photo?.width && photo?.height ? photo.width / photo.height : 1;
  const selectedRatio = cropRatio || originalRatio;
  const canvasWidth = useMemo(
    () => Math.min(screenWidth - 36, screenHeight * 0.43 * selectedRatio),
    [screenHeight, screenWidth, selectedRatio]
  );
  const canvasHeight = canvasWidth / selectedRatio;
  const brightnessTint = brightness > 0
    ? `rgba(255,255,255,${brightness.toFixed(2)})`
    : `rgba(0,0,0,${Math.abs(brightness).toFixed(2)})`;

  const save = async () => {
    setSaving(true);
    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      await saveViewToGallery(canvasRef.current, selectedRatio, setSaving);
    } catch (error) {
      Alert.alert('保存失败', error instanceof Error ? error.message : '请稍后重试。');
    } finally { setSaving(false); }
  };

  const selectTool = (tool: ToolId) => {
    if (tool === 'crop') { setCropping(true); return; }
    setActiveTool(tool);
    setPanelVisible((wasVisible) => (activeTool === tool ? !wasVisible : true));
    if (tool === 'text') {
      setTextDraft('');
      setTextModalVisible(true);
    }
  };

  if (!photo) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Text style={styles.empty}>请先从首页选择一张照片。</Text>
      </SafeAreaView>
    );
  }

  if (cropping) return <SafeAreaView style={styles.safe} edges={['top', 'bottom']}><CropEditor photo={photo} onCancel={() => setCropping(false)} onApply={(output) => { setEditedPhoto(output); setCropRatio(0); setZoom(1); setRotation(0); setCropping(false); }} /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerButton} accessibilityLabel="返回">
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>照片编辑</Text>
        <Pressable onPress={() => void save()} disabled={saving} style={styles.saveButton}>
          <Text style={styles.saveText}>{saving ? '保存中' : '保存'}</Text>
        </Pressable>
      </View>

      <View style={styles.canvasArea}>
        <View
          ref={canvasRef}
          collapsable={false}
          style={[styles.canvas, { width: canvasWidth, height: canvasHeight }]}
        >
          <Image
            source={{ uri: photo.uri }}
            resizeMode="cover"
            style={[StyleSheet.absoluteFill, { transform: [{ scale: zoom }, { rotate: `${rotation}deg` }] }]}
          />
          {filter.tint !== 'transparent' ? (
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: filter.tint }]} />
          ) : null}
          {brightness !== 0 ? (
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: brightnessTint }]} />
          ) : null}
          {layers.map((layer) => <MovableLayer key={layer.id} layer={layer} width={canvasWidth} height={canvasHeight} selected={selectedLayer === layer.id} clean={saving} onSelect={() => setSelectedLayer(layer.id)} onMove={(x, y) => setLayers((current) => current.map((item) => item.id === layer.id ? { ...item, x, y } : item))} />)}
        </View>
      </View>

      {panelVisible ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>{TOOLS.find((tool) => tool.id === activeTool)?.label}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.panelItems}>
            {activeTool === 'crop' ? CROP_RATIOS.map((option) => (
              <Chip
                key={option.label}
                label={option.label}
                selected={cropRatio === option.value}
                onPress={() => setCropRatio(option.value)}
              />
            )) : null}
            {activeTool === 'filter' ? FILTERS.map((option) => (
              <Pressable
                key={option.name}
                onPress={() => setFilter(option)}
                style={[styles.filterChoice, filter.name === option.name && styles.filterChoiceActive]}
              >
                <Text style={[styles.filterText, filter.name === option.name && styles.filterTextActive]}>{option.name}</Text>
              </Pressable>
            )) : null}
            {activeTool === 'adjust' ? (
              <View style={styles.adjustRow}>
                <Text style={styles.adjustLabel}>亮度</Text>
                <Pressable style={styles.adjustButton} onPress={() => setBrightness((value) => Math.max(-0.35, Number((value - 0.05).toFixed(2))))} accessibilityLabel="降低亮度">
                  <Text style={styles.adjustButtonText}>−</Text>
                </Pressable>
                <Text style={styles.adjustValue}>{Math.round(brightness * 100)}%</Text>
                <Pressable style={styles.adjustButton} onPress={() => setBrightness((value) => Math.min(0.35, Number((value + 0.05).toFixed(2))))} accessibilityLabel="提高亮度">
                  <Text style={styles.adjustButtonText}>＋</Text>
                </Pressable>
                <Pressable style={styles.adjustButton} onPress={() => setZoom((value) => Math.max(1, Number((value - 0.1).toFixed(2))))} accessibilityLabel="缩小照片">
                  <Text style={styles.adjustButtonText}>－</Text>
                </Pressable>
                <Text style={styles.adjustValue}>{Math.round(zoom * 100)}%</Text>
                <Pressable style={styles.adjustButton} onPress={() => setZoom((value) => Math.min(1.8, Number((value + 0.1).toFixed(2))))} accessibilityLabel="放大照片">
                  <Text style={styles.adjustButtonText}>＋</Text>
                </Pressable>
                <Pressable style={styles.rotateButton} onPress={() => setRotation((value) => (value + 90) % 360)}>
                  <Text style={styles.rotateText}>旋转</Text>
                </Pressable>
              </View>
            ) : null}
            {activeTool === 'text' ? <Text style={styles.hint}>点击 T 添加文字 · 拖动文字移动位置</Text> : null}
            {activeTool === 'sticker' ? STICKERS.map((sticker, index) => (
              <Pressable key={`${sticker}-${index}`} style={styles.stickerChoice} onPress={() => addLayer('sticker', sticker)}>
                <Text style={styles.stickerChoiceText}>{sticker}</Text>
              </Pressable>
            )) : null}
          </ScrollView>
          {selectedLayer ? <Pressable style={styles.clearStickers} onPress={() => { setLayers((current) => current.filter((layer) => layer.id !== selectedLayer)); setSelectedLayer(null); }}><Text style={styles.clearStickersText}>删除选中的文字 / 贴纸</Text></Pressable> : null}
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
              <Pressable onPress={() => { if (textDraft.trim()) addLayer('text', textDraft.trim()); setTextModalVisible(false); }} style={[styles.modalAction, styles.modalConfirm]}>
                <Text style={styles.modalConfirmText}>应用</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  canvasArea: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  canvas: { overflow: 'hidden', backgroundColor: '#202027' },
  empty: { color: '#FFFFFF', padding: 20 },
  panel: { minHeight: 89, paddingTop: 9, paddingBottom: 8, backgroundColor: colors.editorPanel, borderTopWidth: 1, borderColor: '#37373E' },
  panelTitle: { color: '#FFFFFF', fontSize: 11, fontWeight: '700', paddingHorizontal: 15, paddingBottom: 6 },
  panelItems: { alignItems: 'center', gap: 9, paddingHorizontal: 14, minHeight: 42 },
  filterChoice: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: '#3B3A43' },
  filterChoiceActive: { backgroundColor: colors.violet },
  filterText: { color: '#E2E0E8', fontSize: 12, fontWeight: '600' },
  filterTextActive: { color: '#FFFFFF' },
  adjustRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  adjustLabel: { color: '#E6E3EC', fontSize: 11, marginRight: 2 },
  adjustButton: { width: 31, height: 32, borderRadius: 10, backgroundColor: '#45434D', alignItems: 'center', justifyContent: 'center' },
  adjustButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '600' },
  adjustValue: { color: '#FFFFFF', fontSize: 10, minWidth: 32, textAlign: 'center' },
  rotateButton: { paddingHorizontal: 10, height: 32, borderRadius: 10, backgroundColor: '#45434D', justifyContent: 'center' },
  rotateText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  hint: { color: '#D5D2DC', fontSize: 12 },
  stickerChoice: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#45434D', alignItems: 'center', justifyContent: 'center' },
  stickerChoiceText: { fontSize: 21 },
  clearStickers: { alignSelf: 'flex-end', marginHorizontal: 15, marginTop: 5 },
  clearStickersText: { color: '#AAA1FF', fontSize: 11, fontWeight: '700' },
  stickerLayer: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
  sticker: { position: 'absolute', fontSize: 34, textShadowColor: 'rgba(0,0,0,0.18)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  caption: { position: 'absolute', bottom: 20, left: 12, right: 12, color: '#FFFFFF', fontSize: 23, fontWeight: '800', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.75)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
  toolbar: { minHeight: 77, paddingHorizontal: 8, paddingTop: 9, flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.editor },
  toolItem: { flex: 1, alignItems: 'center', gap: 4 },
  toolIcon: { color: '#F0EFF4', fontSize: 23, lineHeight: 29 },
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
});
