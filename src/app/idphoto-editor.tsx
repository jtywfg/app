import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { captureRef, releaseCapture } from 'react-native-view-shot';
import * as Library from 'expo-media-library/legacy';
import { chrome, IDPhotoButton, IDPhotoHeader, idColors } from '../components/IDPhotoChrome';
import { IDPhotoPortrait, IDPhotoSuit } from '../components/IDPhotoPortrait';
import { SuitGestureLayer } from '../components/SuitGestureLayer';
import { detectIDPhoto, getIDPhotoSpec, getPrintLayout, ID_BACKGROUNDS, replaceIDBackground, type IDPhotoSpec } from '../lib/idPhoto';
import { DEFAULT_SUIT_PLACEMENT, fitSuitToFace, type SuitPlacement } from '../lib/idphotoSuitLayout';
import { persistGalleryPhoto } from '../lib/persistGalleryPhoto';
import { useStudio } from '../store/StudioContext';
import type { PhotoAsset } from '../types';
import { FORMALWEAR, type SuitGroup } from '../lib/formalwear';

import { BEAUTY_CONTROLS, MAKEUP_CONTROLS, NO_PORTRAIT_EFFECTS, PORTRAIT_PRESETS } from '../lib/portraitEffects';

const SUIT_GROUPS: SuitGroup[] = ['女装', '男装', '童装'];

export default function IDPhotoEditorScreen() {
  const params = useLocalSearchParams<{ spec?: string; backgroundOnly?: string }>();
  const { photos } = useStudio();
  const [original] = useState(() => photos[0]);
  const backgroundOnly = params.backgroundOnly === '1';
  const standard: IDPhotoSpec = params.spec ? JSON.parse(params.spec) : getIDPhotoSpec();
  const spec = backgroundOnly && original ? { ...standard, name: '证件照换底色', width: original.width, height: original.height, mmWidth: Math.round(original.width / 300 * 25.4), mmHeight: Math.round(original.height / 300 * 25.4) } : standard;
  const { width, height } = useWindowDimensions();
  const [photo, setPhoto] = useState<PhotoAsset | null>(null);
  const [background, setBackground] = useState('#438EFF');
  const [group, setGroup] = useState(0);
  const [tool, setTool] = useState('换背景');
  const [effects, setEffects] = useState(NO_PORTRAIT_EFFECTS);
  const [effectControl, setEffectControl] = useState<'smooth' | 'brighten' | 'detail' | 'lipstick' | 'blush' | 'tone'>('smooth');
  const [suitGroup, setSuitGroup] = useState<SuitGroup>('女装');
  const [suit, setSuit] = useState('none');
  const [placement, setPlacement] = useState<SuitPlacement>(DEFAULT_SUIT_PLACEMENT);
  const automaticPlacement = useRef<SuitPlacement>(DEFAULT_SUIT_PLACEMENT);
  const manuallyAdjusted = useRef(false);
  const [print, setPrint] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [readyCanvas, setReadyCanvas] = useState('');
  const loadedCanvas = useRef({ key: '', slots: new Set<number>() });
  const canvas = useRef<View>(null);
  useEffect(() => {
    let active = true;
    if (original) void detectIDPhoto(original).then((result) => {
      if (!active) return;
      automaticPlacement.current = fitSuitToFace(result.face);
      if (!manuallyAdjusted.current) setPlacement(automaticPlacement.current);
    }).catch(() => { /* Manual fitting remains available if face detection fails. */ });
    return () => { active = false; };
  }, [original]);
  useEffect(() => {
    let active = true;
    // Reset the visible async-operation state whenever an effect input changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProcessing(true); setError(''); setReadyCanvas('');
    if (!original) { setError('请先选择一张照片。'); setProcessing(false); return; }
    const timer = setTimeout(() => { void replaceIDBackground(original, background, effects).then((result) => { if (active) setPhoto(result); }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : '处理照片失败。'); }).finally(() => { if (active) setProcessing(false); }); }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [original, background, effects]);
  const maxHeight = Math.max(180, height - (backgroundOnly ? 340 : 425));
  const canvasWidth = Math.min(width - 110, maxHeight * spec.width / spec.height, 330);
  const canvasHeight = canvasWidth * spec.height / spec.width;
  const sheet = getPrintLayout(spec);
  const sheetScale = (width - 36) / sheet.width;
  const canvasKey = `${photo?.uri}:${suit}:${print}:${width}:${height}`;
  const ready = readyCanvas === canvasKey;
  const imageReady = (index = 0) => {
    if (loadedCanvas.current.key !== canvasKey) loadedCanvas.current = { key: canvasKey, slots: new Set() };
    loadedCanvas.current.slots.add(index);
    if (loadedCanvas.current.slots.size === (print ? sheet.slots.length : 1)) setReadyCanvas(canvasKey);
  };
  const save = async () => {
    if (saving || processing) return;
    if (error) { Alert.alert('无法保存', error); return; }
    if (!canvas.current || !photo || !ready) { Alert.alert('图片尚未就绪', '请等待照片与正装加载完成后重试。'); return; }
    setSaving(true);
    let uri: string | undefined;
    try {
      const permission = await Library.requestPermissionsAsync(false, ['photo']);
      if (!permission.granted) throw new Error('请允许保存图片到系统相册。');
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      uri = await captureRef(canvas, { format: 'jpg', quality: 1, result: 'tmpfile', width: print ? sheet.width : spec.width, height: print ? sheet.height : spec.height });
      const destination = await persistGalleryPhoto(uri, Platform.OS, Library);
      Alert.alert('保存成功', `${print ? '排版照' : '电子证件照'}已保存到${destination}。\n${print ? `${sheet.width}×${sheet.height}` : `${spec.width}×${spec.height}`}px，无水印。`);
    } catch (cause) { Alert.alert('保存失败', cause instanceof Error ? cause.message : '请重试。'); }
    finally { if (uri) releaseCapture(uri); setSaving(false); }
  };
  if (!original) return <SafeAreaView style={chrome.safe}><IDPhotoHeader title="证件照" /><Text style={{ padding: 25 }}>请先选择一张照片。</Text></SafeAreaView>;
  return <SafeAreaView style={chrome.safe} edges={['top', 'bottom']}>
    <IDPhotoHeader title={spec.name} />
    {!backgroundOnly ? <View style={styles.previewTabs}>{['电子照预览', '排版照预览'].map((label, index) => <Pressable key={label} onPress={() => setPrint(index === 1)} style={styles.previewTab}><Text style={[styles.tabText, print === (index === 1) && styles.tabActive]}>{label}</Text></Pressable>)}</View> : null}
    <View style={styles.preview}>
      {photo ? print ? <><View ref={canvas} collapsable={false} style={{ width: sheet.width * sheetScale, height: sheet.height * sheetScale, backgroundColor: '#FFFFFF' }}>{sheet.slots.map((slot, index) => <View key={index} style={{ position: 'absolute', left: slot.x * sheetScale, top: slot.y * sheetScale }}><IDPhotoPortrait uri={photo.uri} width={slot.width * sheetScale} height={slot.height * sheetScale} suit={suit} placement={placement} onLoad={() => imageReady(index)} onError={() => setError('照片或正装素材加载失败，请重新选择正装。')} /></View>)}</View><Text style={styles.printHint}>请使用6寸相纸按实际尺寸打印</Text></> : <View style={styles.dimensions}><Text style={styles.dimension}>{spec.width}px</Text><View style={styles.portraitRow}><Text style={styles.sideDimension}>{spec.mmHeight}mm</Text><View style={{ width: canvasWidth, height: canvasHeight }}><View ref={canvas} collapsable={false}><IDPhotoPortrait uri={photo.uri} width={canvasWidth} height={canvasHeight} suit={suit} placement={placement} onLoad={() => imageReady()} onError={() => setError('照片或正装素材加载失败，请重新选择正装。')} /></View>{tool === '换正装' && suit !== 'none' && !processing && !saving ? <SuitGestureLayer width={canvasWidth} height={canvasHeight} placement={placement} onChange={(value) => { manuallyAdjusted.current = true; setPlacement(value); }} /> : null}</View><Text style={styles.sideDimension}>{spec.height}px</Text></View><Text style={styles.dimension}>{spec.mmWidth}mm</Text></View> : <ActivityIndicator color={idColors.blue} size="large" />}
      {processing ? <View style={styles.processing}><ActivityIndicator color={idColors.blue} /><Text style={{ color: idColors.blue }}>正在处理照片…</Text></View> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
    {!print ? <>
      {!backgroundOnly ? <View style={styles.toolRow}>{['换背景', '美颜', '美妆', '换正装'].map((name) => <Pressable key={name} onPress={() => { setTool(name); if (name === '美颜') setEffectControl('smooth'); if (name === '美妆') setEffectControl('lipstick'); }} style={[styles.tool, tool === name && styles.toolActive]}><Text style={styles.toolText}>{name}</Text></Pressable>)}</View> : null}
      <View style={styles.options}>
        {(backgroundOnly || tool === '换背景') ? <><View style={styles.groupRow}>{['基础色', '高级色', '糖果色'].map((name, index) => <Pressable key={name} style={[styles.group, index === group && styles.groupActive]} onPress={() => setGroup(index)}><Text style={[styles.groupText, index === group && { color: idColors.blue }]}>{name}</Text></Pressable>)}</View><View style={styles.colorRow}>{ID_BACKGROUNDS[group].map((color) => <Pressable key={color} onPress={() => setBackground(color)} style={[styles.colorFrame, background === color && { borderColor: idColors.blue }]}><View style={[styles.color, { backgroundColor: color }]} /></Pressable>)}</View><Text style={styles.note}>人物与背景分开处理，请预览确认发丝和衣服边缘。</Text></> : tool === '换正装' ? <><View style={styles.groupRow}>{SUIT_GROUPS.map((name) => <Pressable key={name} onPress={() => setSuitGroup(name)} style={[styles.group, name === suitGroup && styles.groupActive]}><Text style={styles.groupText}>{name}</Text></Pressable>)}</View><ScrollView horizontal contentContainerStyle={styles.suits}>{[{ id: 'none', label: '无' }, ...FORMALWEAR[suitGroup]].map(({ id: name, label }) => <Pressable key={name} onPress={() => { if (name !== suit) { setError(''); setSuit(name); } }} style={[styles.suit, name === suit && styles.suitActive]}><View style={styles.suitThumbnail}>{name === 'none' ? <Text style={styles.suitNone}>⊘</Text> : <IDPhotoSuit styleId={name} width={72} height={44} thumbnail />}</View><Text style={{ fontSize: 11 }}>{label}</Text></Pressable>)}</ScrollView><View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12, paddingBottom: 8 }}><Text style={styles.note}>单指移动，双指缩放 / 旋转</Text><Pressable accessibilityRole="button" onPress={() => { manuallyAdjusted.current = false; setPlacement(automaticPlacement.current); }}><Text style={{ color: idColors.blue, fontSize: 12 }}>重新适配</Text></Pressable></View></> : <><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetRow}>{PORTRAIT_PRESETS.map((preset) => <Pressable key={preset.label} style={styles.preset} onPress={() => setEffects({ ...preset.effects })}><Text style={styles.groupText}>{preset.label}</Text></Pressable>)}<Pressable style={styles.preset} onPress={() => setEffects((value) => ({ ...value, ...(tool === '美颜' ? { smooth: 0, brighten: 0, detail: 0 } : { lipstick: 0, blush: 0, tone: 0 }) }))}><Text style={styles.groupText}>重置本项</Text></Pressable></ScrollView><View style={styles.effectRow}>{(tool === '美颜' ? BEAUTY_CONTROLS : MAKEUP_CONTROLS).map((item) => <Pressable key={item.key} style={[styles.effectControl, effectControl === item.key && styles.groupActive]} onPress={() => setEffectControl(item.key)}><Text style={styles.effectLabel}>{item.label} {effects[item.key]}</Text></Pressable>)}</View><View style={styles.intensity}><Pressable accessibilityLabel="降低强度" style={styles.step} onPress={() => setEffects((value) => ({ ...value, [effectControl]: Math.max(0, value[effectControl] - 10) }))}><Text>－</Text></Pressable>{[0, 25, 50, 75, 100].map((amount) => <Pressable key={amount} accessibilityLabel={`强度 ${amount}`} style={[styles.strength, effects[effectControl] === amount && styles.groupActive]} onPress={() => setEffects((value) => ({ ...value, [effectControl]: amount }))}><Text style={styles.effectLabel}>{amount}</Text></Pressable>)}<Pressable accessibilityLabel="增加强度" style={styles.step} onPress={() => setEffects((value) => ({ ...value, [effectControl]: Math.min(100, value[effectControl] + 10) }))}><Text>＋</Text></Pressable></View><Text style={styles.note}>独立调节强度 · 保留五官比例；正式证件照建议使用轻度效果</Text></>}
      </View>
    </> : <Text style={styles.note}>排版照与电子照同步；请在电子照预览中调整。</Text>}
    <View style={chrome.bottom}><IDPhotoButton disabled={!photo || processing || saving || !!error} title={saving ? '保存中…' : print ? '保存排版照' : backgroundOnly ? '保存至相册' : '保存电子版'} onPress={() => void save()} /></View>
  </SafeAreaView>;
}
const styles = StyleSheet.create({ presetRow: { gap: 6 }, preset: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, backgroundColor: '#F4F5FA' }, effectControl: { padding: 8, borderRadius: 18 }, effectLabel: { fontSize: 12, color: '#555' }, intensity: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, step: { padding: 10 }, strength: { padding: 8, borderRadius: 12 }, previewTabs: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderTopWidth: 1, borderColor: '#EEEEEE' }, previewTab: { flex: 1, alignItems: 'center' }, tabText: { fontSize: 17, color: '#999999', paddingVertical: 15 }, tabActive: { color: idColors.blue, borderBottomWidth: 3, borderColor: idColors.blue }, preview: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 10 }, dimensions: { alignItems: 'center', gap: 8 }, dimension: { color: '#999999', fontSize: 14 }, portraitRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, sideDimension: { color: '#999999', fontSize: 12, width: 42, textAlign: 'center' }, toolRow: { flexDirection: 'row', marginHorizontal: 20, borderRadius: 30, borderWidth: 1, borderColor: '#E6E6EC', backgroundColor: '#FFFFFF' }, tool: { flex: 1, paddingVertical: 12, alignItems: 'center', borderWidth: 1.5, borderColor: 'transparent', borderRadius: 30 }, toolActive: { borderColor: idColors.blue, backgroundColor: '#EDF2FF' }, toolText: { fontSize: 15 }, options: { minHeight: 140, backgroundColor: '#FFFFFF', paddingHorizontal: 14, paddingTop: 10, marginTop: 12, gap: 12 }, groupRow: { flexDirection: 'row', justifyContent: 'space-around' }, group: { paddingHorizontal: 17, paddingVertical: 8, borderRadius: 25 }, groupActive: { backgroundColor: '#EFEEFF' }, groupText: { fontSize: 15, color: '#666666' }, colorRow: { flexDirection: 'row', justifyContent: 'space-around' }, colorFrame: { borderWidth: 1, borderColor: 'transparent', padding: 3, borderRadius: 30 }, color: { width: 35, height: 35, borderRadius: 20, borderWidth: 1, borderColor: '#EEEEEE' }, note: { fontSize: 11, textAlign: 'center', color: '#969696', paddingBottom: 8 }, suits: { gap: 10, paddingHorizontal: 8, paddingBottom: 5 }, suit: { width: 88, height: 80, borderWidth: 1, borderColor: '#DDDDDD', borderRadius: 9, backgroundColor: '#F2F3F6', alignItems: 'center', justifyContent: 'center', gap: 2 }, suitActive: { borderColor: idColors.blue, backgroundColor: '#EFEEFF' }, suitThumbnail: { width: 74, height: 48, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, suitNone: { color: '#A2A4AC', fontSize: 30 }, effectRow: { flexDirection: 'row', justifyContent: 'space-around' }, effectTitle: { fontSize: 14, color: '#666666', textAlign: 'center', padding: 8 }, printHint: { fontSize: 12, color: '#999999', alignSelf: 'flex-end', padding: 16 }, processing: { position: 'absolute', backgroundColor: '#FFFFFFDD', padding: 14, borderRadius: 12, gap: 8, alignItems: 'center' }, error: { color: '#BD3E45', fontSize: 13, padding: 15, textAlign: 'center' } });
