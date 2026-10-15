import React, { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, Pressable, StatusBar, StyleSheet, Text, View, useWindowDimensions, type NativeSyntheticEvent, type NativeTouchEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { captureRef, releaseCapture } from 'react-native-view-shot';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as MediaLibrary from 'expo-media-library/legacy';
import { getGridSlices, GRID_OPTIONS } from '../lib/imageComposition';
import { startGesture, type GestureStart, type Point, type FreeTransform } from '../lib/freeTransform';
import { updateGridGesture } from '../lib/gridGesture';
import { persistGalleryPhoto } from '../lib/persistGalleryPhoto';
import { useStudio } from '../store/StudioContext';
import { colors } from '../theme';

type ActiveGesture = { start: GestureStart; imageWidth: number; imageHeight: number };

function touchPoints(event: NativeSyntheticEvent<NativeTouchEvent>): Point[] {
  const touches = event.nativeEvent.touches.length ? event.nativeEvent.touches : event.nativeEvent.changedTouches;
  return touches.slice(0, 2).map((touch) => ({ pageX: touch.pageX, pageY: touch.pageY }));
}

export default function GridEditorScreen() {
  const router = useRouter();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { photos } = useStudio();
  const photo = photos[0];
  const [optionIndex, setOptionIndex] = useState(2);
  const [step, setStep] = useState<'crop' | 'slices'>('crop');
  const [transform, setTransform] = useState<FreeTransform>({ x: 0, y: 0, scale: 1, rotation: 0 });
  const [saving, setSaving] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const activeGesture = useRef<ActiveGesture | null>(null);
  const imageViewport = useRef<View>(null);
  const option = GRID_OPTIONS[optionIndex];
  const cellSize = Math.min((screenWidth - 32) / option.columns, screenHeight * 0.52 / option.rows);
  const canvasWidth = cellSize * option.columns;
  const canvasHeight = cellSize * option.rows;
  const coverScale = photo ? Math.max(canvasWidth / Math.max(1, photo.width), canvasHeight / Math.max(1, photo.height)) : 1;
  const baseImageWidth = photo ? photo.width * coverScale : canvasWidth;
  const baseImageHeight = photo ? photo.height * coverScale : canvasHeight;
  const shownImageWidth = baseImageWidth * transform.scale;
  const shownImageHeight = baseImageHeight * transform.scale;
  const slices = getGridSlices(1200, Math.round(1200 * option.rows / option.columns), option.columns, option.rows);

  const beginGesture = (event: NativeSyntheticEvent<NativeTouchEvent>) => {
    const points = touchPoints(event);
    if (!points.length) return;
    activeGesture.current = { start: startGesture(transform, points), imageWidth: baseImageWidth, imageHeight: baseImageHeight };
  };

  const moveGesture = (event: NativeSyntheticEvent<NativeTouchEvent>) => {
    const active = activeGesture.current;
    const points = touchPoints(event);
    if (!active || !points.length) return;
    if (points.length !== active.start.points) {
      beginGesture(event);
      return;
    }
    setTransform(updateGridGesture(active.start, points, canvasWidth, canvasHeight, active.imageWidth, active.imageHeight));
  };

  const saveSlices = async (selectedIndex?: number) => {
    if (!photo || saving || !imageViewport.current) return;
    if (!imageLoaded) {
      Alert.alert('照片正在加载', '请稍等片刻后再保存。');
      return;
    }
    setSaving(true);
    let canvasUri: string | undefined;
    try {
      const permission = await MediaLibrary.requestPermissionsAsync(Platform.OS === 'ios', ['photo']);
      if (!permission.granted) throw new Error('请允许 PinPic 保存图片到系统相册后重试。');
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const outputWidth = 1200;
      const outputHeight = Math.round(outputWidth * option.rows / option.columns);
      canvasUri = await captureRef(imageViewport, {
        format: 'jpg',
        quality: 0.98,
        result: 'tmpfile',
        width: outputWidth,
        height: outputHeight,
      });
      const targets = selectedIndex === undefined ? slices : [slices[selectedIndex]];
      for (const slice of targets) {
        const context = ImageManipulator.manipulate(canvasUri);
        let cropped: Awaited<ReturnType<typeof context.renderAsync>> | undefined;
        try {
          cropped = await context.crop({ originX: slice.x, originY: slice.y, width: slice.width, height: slice.height }).renderAsync();
          const part = await cropped.saveAsync({ format: SaveFormat.JPEG, compress: 0.96 });
          await persistGalleryPhoto(part.uri, Platform.OS, MediaLibrary);
        } finally {
          cropped?.release();
          context.release();
        }
      }
      Alert.alert('保存成功', selectedIndex === undefined ? `已保存 ${targets.length} 张分割图片。` : `第 ${selectedIndex + 1} 张已保存。`);
    } catch (cause) {
      Alert.alert('保存失败', cause instanceof Error ? cause.message : '请稍后重试。');
    } finally {
      if (canvasUri) releaseCapture(canvasUri);
      setSaving(false);
    }
  };

  if (!photo) {
    return <SafeAreaView style={styles.safe}><Text style={styles.hint}>请先选择一张照片。</Text></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Pressable onPress={() => step === 'slices' ? setStep('crop') : router.back()} style={styles.headerButton}><Text style={styles.back}>‹</Text></Pressable>
        <Text style={styles.title}>{step === 'crop' ? '九宫格切图' : '预览与保存'}</Text>
        {step === 'crop' ? <Pressable onPress={() => { if (!imageLoaded) Alert.alert('照片正在加载', '请稍等片刻后再试。'); else setStep('slices'); }} style={styles.nextButton}><Text style={styles.nextText}>下一步</Text></Pressable> : <Pressable onPress={() => router.replace('/')} style={styles.homeButton}><Text style={styles.homeIcon}>⌂</Text></Pressable>}
      </View>

      <View style={styles.canvasArea}>
        <View
          onStartShouldSetResponder={() => step === 'crop'}
          onMoveShouldSetResponder={() => step === 'crop'}
          onResponderTerminationRequest={() => false}
          onResponderGrant={beginGesture}
          onResponderStart={beginGesture}
          onResponderMove={moveGesture}
          onResponderEnd={(event) => { if (event.nativeEvent.touches.length) beginGesture(event); else activeGesture.current = null; }}
          onResponderRelease={() => { activeGesture.current = null; }}
          style={[styles.canvas, { width: canvasWidth, height: canvasHeight }]}
        >
          <View ref={imageViewport} collapsable={false} style={[styles.imageViewport, { width: canvasWidth, height: canvasHeight }]}>
            <Image
              source={{ uri: photo.uri }}
              resizeMode="cover"
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageLoaded(false)}
              style={{
                position: 'absolute',
                left: (canvasWidth - shownImageWidth) / 2 + transform.x,
                top: (canvasHeight - shownImageHeight) / 2 + transform.y,
                width: shownImageWidth,
                height: shownImageHeight,
                transform: [{ rotate: `${transform.rotation}deg` }],
              }}
            />
          </View>
          {Array.from({ length: option.columns - 1 }, (_, index) => <View key={`column-${index}`} pointerEvents="none" style={[styles.gridLine, styles.verticalLine, { left: `${(index + 1) * 100 / option.columns}%` }]} />)}
          {Array.from({ length: option.rows - 1 }, (_, index) => <View key={`row-${index}`} pointerEvents="none" style={[styles.gridLine, styles.horizontalLine, { top: `${(index + 1) * 100 / option.rows}%` }]} />)}
          {step === 'slices' ? slices.map((slice) => (
            <Pressable
              key={slice.index}
              style={[styles.sliceNumber, { left: `${(slice.column + 0.5) * 100 / option.columns}%`, top: `${(slice.row + 0.5) * 100 / option.rows}%` }]}
              onPress={() => void saveSlices(slice.index)}
              disabled={saving}
            >
              <Text style={styles.sliceNumberText}>{slice.index + 1}</Text>
            </Pressable>
          )) : null}
        </View>
      </View>

      {step === 'crop' ? (
        <>
          <Text style={styles.instruction}>单指移动 · 双指缩放并旋转 · 点按下一步查看每一格</Text>
          <View style={styles.options}>
            {GRID_OPTIONS.map((item, index) => (
              <Pressable key={item.label} style={[styles.option, index === optionIndex && styles.optionActive]} onPress={() => { setOptionIndex(index); setTransform({ x: 0, y: 0, scale: 1, rotation: 0 }); }}>
                <View style={styles.miniGrid}>
                  {Array.from({ length: item.columns * item.rows }, (_, cell) => <View key={cell} style={[styles.miniCell, index === optionIndex && styles.miniCellActive]} />)}
                </View>
                <Text style={[styles.optionLabel, index === optionIndex && styles.optionLabelActive]}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : (
        <View style={styles.saveArea}>
          <Text style={styles.instruction}>点击数字保存单张图片</Text>
          <Pressable style={styles.saveAll} onPress={() => void saveSlices()} disabled={saving}>
            <Text style={styles.saveAllText}>{saving ? '正在保存…' : '全部保存'}</Text>
          </Pressable>
        </View>
      )}
      {saving ? <View pointerEvents="none" style={styles.busy}><ActivityIndicator color="#FFFFFF" size="large" /></View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#252528' },
  header: { height: 62, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerButton: { width: 70, height: 48, justifyContent: 'center' },
  back: { color: '#FFFFFF', fontSize: 38, lineHeight: 44 },
  title: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  nextButton: { minWidth: 82, minHeight: 40, paddingHorizontal: 14, borderRadius: 9, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.violet },
  nextText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  homeButton: { width: 60, alignItems: 'flex-end' },
  homeIcon: { color: '#FFFFFF', fontSize: 32 },
  canvasArea: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  canvas: { position: 'relative', overflow: 'hidden', backgroundColor: '#000000' },
  imageViewport: { position: 'absolute', left: 0, top: 0, overflow: 'hidden', backgroundColor: '#000000' },
  gridLine: { position: 'absolute', zIndex: 2, backgroundColor: 'rgba(255,255,255,0.93)' },
  verticalLine: { top: 0, bottom: 0, width: 1 },
  horizontalLine: { left: 0, right: 0, height: 1 },
  sliceNumber: { position: 'absolute', zIndex: 3, width: 50, height: 50, marginLeft: -25, marginTop: -25, borderRadius: 25, backgroundColor: 'rgba(15,15,18,0.68)', alignItems: 'center', justifyContent: 'center' },
  sliceNumberText: { color: '#FFFFFF', fontSize: 23, fontWeight: '700' },
  instruction: { color: '#E1DFE8', fontSize: 13, textAlign: 'center', paddingHorizontal: 16, paddingVertical: 15 },
  options: { minHeight: 100, paddingHorizontal: 12, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  option: { width: 72, height: 72, borderRadius: 15, alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderColor: 'transparent' },
  optionActive: { backgroundColor: '#35333E', borderColor: colors.violet },
  miniGrid: { width: 36, height: 30, flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  miniCell: { width: 9, height: 6, backgroundColor: '#D7D5DC' },
  miniCellActive: { backgroundColor: '#A99BFF' },
  optionLabel: { color: '#D2CFDA', fontSize: 11 },
  optionLabelActive: { color: '#B8ACFF', fontWeight: '700' },
  saveArea: { minHeight: 142, paddingHorizontal: 24, paddingBottom: 12, justifyContent: 'center' },
  saveAll: { height: 54, borderRadius: 12, backgroundColor: colors.violet, alignItems: 'center', justifyContent: 'center' },
  saveAllText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  hint: { color: '#FFFFFF', padding: 20 },
  busy: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.24)' },
});
