import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions, type NativeSyntheticEvent, type NativeTouchEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Library from 'expo-media-library/legacy';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import Svg, { Path } from 'react-native-svg';
import { chrome, IDPhotoButton, idColors } from '../components/IDPhotoChrome';
import { ID_PHOTO_SPECS } from '../lib/idPhoto';
import { startCropGesture, updateCropGesture, type CropGestureStart, type PhotoPanZoom } from '../lib/cropGesture';
import { getUtilityCrop, mmToPixels, pixelsToMM } from '../lib/photoUtilityGeometry';
import { persistGalleryPhoto } from '../lib/persistGalleryPhoto';
import type { PhotoAsset } from '../types';

type EncodedPhoto = PhotoAsset & { bytes: number };
const categories = ['常用尺寸', '近期热门', '考试证照', '护照签证', '个人证件'];
const identity: PhotoPanZoom = { x: 0, y: 0, scale: 1 };
function touchPoints(event: NativeSyntheticEvent<NativeTouchEvent>) {
  return event.nativeEvent.touches.slice(0, 2).map(({ pageX, pageY }) => ({ pageX, pageY }));
}
function formatBytes(bytes: number) {
  return bytes >= 1024 * 1024 ? (bytes / 1024 / 1024).toFixed(2) + ' MB' : (bytes / 1024).toFixed(1) + ' KB';
}
async function encode(photo: PhotoAsset, width: number, height: number, quality: number, crop?: ReturnType<typeof getUtilityCrop>): Promise<EncodedPhoto> {
  const context = ImageManipulator.manipulate(photo.uri);
  try {
    if (crop) context.crop(crop);
    context.resize({ width, height });
    const image = await context.renderAsync();
    try {
      const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: quality });
      return { ...result, bytes: new File(result.uri).size };
    } finally { image.release(); }
  } finally { context.release(); }
}

function QualitySlider({ value, onChange, disabled }: { value: number; onChange: (value: number) => void; disabled: boolean }) {
  const [width, setWidth] = useState(1);
  const change = (event: NativeSyntheticEvent<NativeTouchEvent>) => {
    if (!disabled) onChange(Math.max(0.05, Math.min(1, event.nativeEvent.locationX / width)));
  };
  return <View style={styles.sliderRow}><Text style={styles.muted}>一般</Text>
    <View accessibilityRole="adjustable" accessibilityLabel="JPEG 质量" accessibilityValue={{ min: 5, max: 100, now: Math.round(value * 100) }} accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]} onAccessibilityAction={(event) => !disabled && onChange(Math.max(0.05, Math.min(1, value + (event.nativeEvent.actionName === 'increment' ? 0.05 : -0.05))))}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)} onStartShouldSetResponder={() => !disabled} onMoveShouldSetResponder={() => !disabled} onResponderGrant={change} onResponderMove={change} style={styles.sliderTouch}>
      <View pointerEvents="none" style={styles.sliderTrack}><View style={[styles.sliderFill, { width: `${value * 100}%` as `${number}%` }]} /></View>
      <View pointerEvents="none" style={[styles.sliderThumb, { left: Math.max(0, Math.min(width - 24, value * width - 12)) }]} />
    </View><Text style={styles.muted}>最优</Text></View>;
}

export default function IDPhotoUtilityScreen() {
  const { mode: rawMode } = useLocalSearchParams<{ mode?: string }>();
  const router = useRouter();
  const isPX = rawMode === 'px';
  const { width: screenWidth } = useWindowDimensions();
  const [photo, setPhoto] = useState<PhotoAsset | null>(null);
  const [unit, setUnit] = useState<'px' | 'mm'>('px');
  const [dimensions, setDimensions] = useState({ width: '295', height: '413' });
  const [quality, setQuality] = useState(1);
  const [stage, setStage] = useState<'crop' | 'preview'>('crop');
  const [transform, setTransform] = useState(identity);
  const [tip, setTip] = useState(false);
  const [category, setCategory] = useState(categories[0]);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('one');
  const [custom, setCustom] = useState(false);
  const [output, setOutput] = useState<EncodedPhoto | null>(null);
  const [encoding, setEncoding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [areaHeight, setAreaHeight] = useState(350);
  const [loaded, setLoaded] = useState(false);
  const gesture = useRef<CropGestureStart | null>(null);
  const widthPX = unit === 'px' ? Number(dimensions.width) : mmToPixels(Number(dimensions.width));
  const heightPX = unit === 'px' ? Number(dimensions.height) : mmToPixels(Number(dimensions.height));
  const validSize = Number.isInteger(widthPX) && Number.isInteger(heightPX) && widthPX >= 16 && heightPX >= 16 && widthPX <= 6000 && heightPX <= 6000 && widthPX * heightPX <= 24_000_000;
  const aspect = validSize ? widthPX / heightPX : 295 / 413;
  const canvasWidth = Math.max(20, Math.min(screenWidth - 100, Math.max(20, areaHeight - 70) * aspect));
  const canvasHeight = canvasWidth / aspect;
  const cover = photo ? Math.max(canvasWidth / photo.width, canvasHeight / photo.height) : 1;
  const baseWidth = photo ? photo.width * cover : canvasWidth;
  const baseHeight = photo ? photo.height * cover : canvasHeight;
  const hasPreview = photo && (!isPX || stage === 'preview');

  useEffect(() => {
    if (!photo || !validSize || (isPX && stage !== 'preview')) return;
    let active = true;
    // Encode after input settles. An older request must never overwrite a newer preview.
    const timer = setTimeout(() => {
      setEncoding(true); setError(''); setOutput(null);
      const crop = isPX ? getUtilityCrop(photo.width, photo.height, canvasWidth, canvasHeight, transform) : undefined;
      encode(photo, widthPX, heightPX, quality, crop).then((result) => {
        if (active) setOutput(result);
        else { const file = new File(result.uri); if (file.exists) file.delete(); }
      }).catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : '处理失败，请重试。');
      }).finally(() => { if (active) setEncoding(false); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [photo, validSize, isPX, stage, widthPX, heightPX, quality, canvasWidth, canvasHeight, transform]);

  const resetOutput = () => { setOutput(null); setError(''); };
  const choose = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) throw new Error('请允许访问照片后再选择图片。');
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: false, quality: 1 });
      if (result.canceled) return;
      const asset = result.assets[0];
      setPhoto({ uri: asset.uri, width: asset.width, height: asset.height, fileName: asset.fileName });
      setLoaded(false); setTransform(identity); setStage('crop'); resetOutput();
      if (isPX) {
        setTip(true); setUnit('px'); setDimensions({ width: '295', height: '413' }); setSelectedId('one');
      } else {
        setDimensions({ width: String(asset.width), height: String(asset.height) }); setUnit('px'); setQuality(1);
      }
    } catch (cause) { Alert.alert('无法选择照片', cause instanceof Error ? cause.message : '请重试。'); }
  };
  const switchUnit = (next: 'px' | 'mm') => {
    if (next === unit) return;
    setDimensions({ width: next === 'px' ? String(widthPX) : pixelsToMM(widthPX).toFixed(2), height: next === 'px' ? String(heightPX) : pixelsToMM(heightPX).toFixed(2) });
    setUnit(next);
  };
  const updateDimension = (key: 'width' | 'height', value: string) => {
    const cleaned = value.replace(unit === 'px' ? /[^0-9]/g : /[^0-9.]/g, '');
    setDimensions((previous) => ({ ...previous, [key]: cleaned }));
    resetOutput();
  };
  const selectSpec = (id: string) => {
    const spec = ID_PHOTO_SPECS.find((item) => item.id === id);
    if (!spec) return;
    setUnit('px'); setDimensions({ width: String(spec.width), height: String(spec.height) }); setSelectedId(id); setTransform(identity); resetOutput();
  };
  const begin = (event: NativeSyntheticEvent<NativeTouchEvent>) => {
    const points = touchPoints(event);
    if (!points.length) return;
    setTip(false);
    gesture.current = startCropGesture(transform, points, (baseWidth / canvasWidth - 1) / 2, (baseHeight / canvasHeight - 1) / 2);
  };
  const move = (event: NativeSyntheticEvent<NativeTouchEvent>) => {
    const points = touchPoints(event);
    if (!gesture.current || !points.length) return;
    if (points.length !== gesture.current.points) { begin(event); return; }
    setTransform(updateCropGesture(gesture.current, points, canvasWidth, canvasHeight));
  };
  const save = async () => {
    if (!output || saving || encoding || !validSize) return;
    setSaving(true);
    try {
      const permission = await Library.requestPermissionsAsync(false, ['photo']);
      if (!permission.granted) throw new Error('请允许保存图片到系统相册。');
      const destination = await persistGalleryPhoto(output.uri, Platform.OS, Library);
      Alert.alert('保存成功', output.width + '×' + output.height + ' px，' + formatBytes(output.bytes) + '\n已保存到' + destination + '。');
    } catch (cause) { Alert.alert('保存失败', cause instanceof Error ? cause.message : '请重试。'); }
    finally { setSaving(false); }
  };
  const list = ID_PHOTO_SPECS.filter((spec) => query ? (spec.name + ' ' + spec.width + 'x' + spec.height).includes(query.trim()) : category === '近期热门' || spec.category === category);
  const fields = <View style={styles.sizeRow}>
    <View style={styles.sizeField}><Text style={styles.fieldLabel}>宽</Text><TextInput editable={!saving} value={dimensions.width} onChangeText={(value) => updateDimension('width', value)} keyboardType="decimal-pad" style={styles.input} maxLength={8} /><Text style={styles.muted}>{unit}</Text></View>
    <Text style={styles.cross}>×</Text>
    <View style={styles.sizeField}><Text style={styles.fieldLabel}>高</Text><TextInput editable={!saving} value={dimensions.height} onChangeText={(value) => updateDimension('height', value)} keyboardType="decimal-pad" style={styles.input} maxLength={8} /><Text style={styles.muted}>{unit}</Text></View>
  </View>;
  const unitTabs = <View style={styles.unitTabs}>{(['px', 'mm'] as const).map((value) => <Pressable disabled={saving} key={value} onPress={() => switchUnit(value)} style={[styles.unitTab, unit === value && styles.unitActive]}><Text style={{ color: unit === value ? idColors.blue : '#FFFFFF', fontSize: 16 }}>{value === 'px' ? '像素' : '毫米'}</Text></Pressable>)}</View>;

  return <SafeAreaView style={chrome.safe} edges={['top', 'bottom']}>
    <View style={chrome.header}><Pressable onPress={() => isPX && stage === 'preview' ? setStage('crop') : router.back()} style={chrome.backButton}><Text style={chrome.back}>‹</Text></Pressable><Text style={chrome.title}>{isPX ? '裁剪' : '修改文件大小'}</Text>
      <Pressable disabled={!photo || !loaded || !validSize} onPress={() => { setTip(false); resetOutput(); setStage('preview'); }} style={styles.next}>{isPX && photo && stage === 'crop' ? <Text style={styles.nextText}>下一步</Text> : null}</Pressable>
    </View>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.previewArea} onLayout={(event) => setAreaHeight(event.nativeEvent.layout.height)}>
        {!photo ? <Pressable onPress={() => void choose()} style={[styles.empty, isPX && styles.dashed]}><View style={styles.plusCircle}><Text style={styles.plus}>＋</Text></View><Text style={styles.placeholder}>{isPX ? '请选择需要裁剪的照片' : '请选择需要修改文件大小的照片'}</Text></Pressable>
          : isPX && stage === 'crop' ? <View style={styles.dimensions}>
            <Text style={styles.dimension}>{widthPX}px</Text>
            <View style={styles.portraitRow}><Text style={styles.sideDimension}>{pixelsToMM(heightPX).toFixed(1)}mm</Text>
              <View onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true} onResponderTerminationRequest={() => false} onResponderGrant={begin} onResponderStart={begin} onResponderMove={move} onResponderEnd={(event) => { if (event.nativeEvent.touches.length) begin(event); else gesture.current = null; }} onResponderRelease={() => { gesture.current = null; }} onResponderTerminate={() => { gesture.current = null; }} style={{ width: canvasWidth, height: canvasHeight, overflow: 'hidden', backgroundColor: '#DDDEE5' }}>
                <Image source={{ uri: photo.uri }} onLoad={() => setLoaded(true)} onError={() => { setLoaded(false); Alert.alert('图片加载失败', '请重新选择图片。'); }} resizeMode="stretch" style={{ position: 'absolute', width: baseWidth * transform.scale, height: baseHeight * transform.scale, left: (canvasWidth - baseWidth * transform.scale) / 2 + transform.x * canvasWidth, top: (canvasHeight - baseHeight * transform.scale) / 2 + transform.y * canvasHeight }} />
                <View pointerEvents="none" style={styles.cropBorder}>{[0, 1, 2, 3].map((corner) => <View key={corner} style={[styles.corner, corner < 2 ? { top: 0, borderTopWidth: 4 } : { bottom: 0, borderBottomWidth: 4 }, corner % 2 === 0 ? { left: 0, borderLeftWidth: 4 } : { right: 0, borderRightWidth: 4 }]} />)}</View>
                {tip ? <Pressable onPress={() => setTip(false)} style={styles.tip}><Text style={styles.tipTitle}>试一试双指放大</Text><Svg width={115} height={140} viewBox="0 0 115 140"><Path d="M39 83 L25 47 Q19 30 30 28 Q39 27 43 43 L52 64 L54 18 Q56 6 65 10 Q73 12 71 25 L69 67 Q76 54 83 62 Q89 55 96 65 Q106 59 108 75 L107 107 Q105 118 96 132 L54 130 Q40 118 32 112 L10 96 Q2 87 9 81 Q16 75 26 81 L40 92" fill="none" stroke="#FFFFFF" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" /></Svg><Text style={styles.gotIt}>知道了</Text></Pressable> : null}
              </View><Text style={styles.sideDimension}>{heightPX}px</Text></View>
            <Text style={styles.dimension}>{pixelsToMM(widthPX).toFixed(1)}mm</Text>
          </View>
          : isPX ? <View style={styles.dimensions}><Text style={styles.dimension}>{widthPX}px</Text><View style={styles.portraitRow}><Text style={styles.sideDimension}>{pixelsToMM(heightPX).toFixed(1)}mm</Text><Image source={{ uri: output?.uri ?? photo.uri }} resizeMode="contain" style={{ width: canvasWidth, height: canvasHeight }} /><Text style={styles.sideDimension}>{heightPX}px</Text></View><Text style={styles.dimension}>{pixelsToMM(widthPX).toFixed(1)}mm</Text></View>
          : <Pressable disabled={saving} onPress={() => void choose()} style={styles.kbPreview}><Image source={{ uri: output?.uri ?? photo.uri }} resizeMode="contain" style={styles.fullImage} /></Pressable>}
        {encoding ? <View style={styles.encoding}><ActivityIndicator color={idColors.blue} /><Text style={styles.muted}>正在生成预览…</Text></View> : null}
      </View>
      {isPX && photo && stage === 'crop' ? <View style={styles.specPanel}>
        <View style={styles.search}><TextInput value={query} onChangeText={setQuery} placeholder="搜索名称、尺寸" style={styles.searchInput} /></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>{categories.map((item) => <Pressable key={item} onPress={() => { setCategory(item); setQuery(''); }}><Text style={[styles.category, category === item && styles.categoryActive]}>{item}</Text></Pressable>)}</ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.specList}><Pressable onPress={() => setCustom(true)} style={[styles.specCard, selectedId === 'custom' && styles.specActive]}><Text style={[styles.specName, selectedId === 'custom' && styles.white]}>自定义尺寸</Text><Text style={[styles.specSize, selectedId === 'custom' && styles.white]}>满足各类需求</Text></Pressable>{list.map((spec) => <Pressable key={spec.id} onPress={() => selectSpec(spec.id)} style={[styles.specCard, selectedId === spec.id && styles.specActive]}><Text style={[styles.specName, selectedId === spec.id && styles.white]}>{spec.name}</Text><Text style={[styles.specSize, selectedId === spec.id && styles.white]}>{spec.width}×{spec.height}px</Text></Pressable>)}</ScrollView>
        <Pressable onPress={() => void choose()}><Text style={styles.reselect}>重新选择照片</Text></Pressable>
      </View> : !isPX && photo ? <View style={styles.panel}>
        <View style={styles.panelHeading}><Text style={styles.label}>尺寸调整</Text>{unitTabs}</View>{fields}
        <Text style={styles.dpi}>毫米按 300 DPI 换算</Text>
        <Text style={styles.label}>质量调整</Text>
        <QualitySlider value={quality} disabled={saving} onChange={(value) => { setQuality(value); resetOutput(); }} />
        <Text style={styles.bytes}>{output ? formatBytes(output.bytes) : '计算中…'}</Text>
        {!validSize ? <Text style={styles.error}>请输入 16–6000 px 的宽高，总像素不超过 2400 万。</Text> : null}
      </View> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {hasPreview ? <View style={chrome.bottom}><IDPhotoButton title={saving ? '保存中…' : isPX ? '导出电子照片' : '保存到相册'} disabled={!output || encoding || saving || !validSize} onPress={() => void save()} /></View> : null}
    </KeyboardAvoidingView>
    <Modal visible={custom} transparent animationType="fade" onRequestClose={() => setCustom(false)}><View style={styles.modalBackdrop}><View style={styles.customPanel}><Text style={styles.label}>自定义尺寸</Text>{unitTabs}{fields}<Text style={styles.dpi}>毫米按 300 DPI 换算</Text><View style={styles.modalButtons}><IDPhotoButton outline title="取消" onPress={() => setCustom(false)} /><IDPhotoButton title="确定" disabled={!validSize} onPress={() => { setSelectedId('custom'); setTransform(identity); resetOutput(); setCustom(false); }} /></View></View></View></Modal>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  flex: { flex: 1 }, previewArea: { flex: 1, minHeight: 160, alignItems: 'center', justifyContent: 'center', padding: 14 }, next: { width: 68, height: 48, justifyContent: 'center', alignItems: 'flex-end' }, nextText: { fontSize: 17, fontWeight: '600' },
  empty: { flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center', gap: 18 }, dashed: { borderWidth: 1, borderColor: '#CACCD5', borderStyle: 'dashed', borderRadius: 12 }, plusCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: idColors.blue, alignItems: 'center', justifyContent: 'center' }, plus: { fontSize: 44, color: '#FFFFFF', lineHeight: 50 }, placeholder: { fontSize: 16, color: '#999999' }, kbPreview: { width: '100%', height: '100%' }, fullImage: { width: '100%', height: '100%' },
  panel: { backgroundColor: '#FFFFFF', paddingHorizontal: 18, paddingTop: 16, gap: 12 }, panelHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, label: { fontSize: 17, fontWeight: '700', color: '#171717' }, unitTabs: { flexDirection: 'row', backgroundColor: idColors.blue, borderRadius: 24, padding: 2 }, unitTab: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 22 }, unitActive: { backgroundColor: '#FFFFFF' }, sizeRow: { flexDirection: 'row', gap: 10, alignItems: 'center' }, sizeField: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, borderWidth: 1.5, borderColor: '#DDDEE7', borderRadius: 8, backgroundColor: '#FFFFFF' }, fieldLabel: { fontSize: 16, color: '#666666' }, input: { flex: 1, minHeight: 47, textAlign: 'right', fontSize: 17, color: '#171717', paddingHorizontal: 5 }, cross: { fontSize: 20, color: '#999999' }, muted: { color: '#888888', fontSize: 13 }, dpi: { fontSize: 11, color: '#999999' },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 }, sliderTouch: { flex: 1, height: 44, justifyContent: 'center' }, sliderTrack: { height: 9, backgroundColor: '#E8E7FF', borderRadius: 5, overflow: 'hidden' }, sliderFill: { height: 9, backgroundColor: idColors.blue }, sliderThumb: { position: 'absolute', width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 4, borderColor: idColors.blue }, bytes: { fontSize: 13, color: idColors.blue, textAlign: 'right', paddingBottom: 5 },
  specPanel: { backgroundColor: '#FFFFFF', paddingTop: 12 }, search: { marginHorizontal: 18, borderRadius: 9, backgroundColor: '#F5F5FA' }, searchInput: { paddingHorizontal: 14, minHeight: 43, fontSize: 16 }, categories: { gap: 20, paddingHorizontal: 18 }, category: { paddingVertical: 16, fontSize: 16, color: '#999999' }, categoryActive: { color: '#171717', fontWeight: '700', borderBottomWidth: 3, borderColor: idColors.blue }, specList: { gap: 12, padding: 15 }, specCard: { minWidth: 124, minHeight: 87, padding: 15, borderRadius: 10, backgroundColor: '#F5F5FB', justifyContent: 'center', gap: 10 }, specActive: { backgroundColor: idColors.blue }, specName: { fontSize: 18, fontWeight: '700' }, specSize: { fontSize: 12, color: '#999999' }, white: { color: '#FFFFFF' }, reselect: { color: idColors.blue, textAlign: 'center', paddingBottom: 12, fontSize: 13 },
  dimensions: { alignItems: 'center', gap: 10 }, dimension: { fontSize: 13, color: '#999999' }, portraitRow: { flexDirection: 'row', alignItems: 'center', gap: 5 }, sideDimension: { fontSize: 11, color: '#999999', width: 39, textAlign: 'center' }, cropBorder: { ...StyleSheet.absoluteFill, borderWidth: 1, borderColor: '#FFFFFF99' }, corner: { position: 'absolute', width: 28, height: 28, borderColor: '#FFFFFF' }, tip: { ...StyleSheet.absoluteFill, backgroundColor: '#00000077', alignItems: 'center', justifyContent: 'space-around', paddingVertical: 20 }, tipTitle: { fontSize: 21, color: '#FFFFFF' }, gotIt: { fontSize: 18, color: '#FFFFFF', borderWidth: 1, borderColor: '#FFFFFF', paddingHorizontal: 18, paddingVertical: 8, borderRadius: 23 }, encoding: { position: 'absolute', backgroundColor: '#FFFFFFE6', padding: 12, borderRadius: 9, alignItems: 'center', gap: 8 }, error: { fontSize: 12, color: '#B83944', textAlign: 'center', padding: 8 },
  modalBackdrop: { flex: 1, backgroundColor: '#00000077', justifyContent: 'center', padding: 20 }, customPanel: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 14, gap: 16 }, modalButtons: { flexDirection: 'row', gap: 12 },
});
