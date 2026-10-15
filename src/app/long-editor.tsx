import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { captureRef, releaseCapture } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library/legacy';
import { fitOutputSize } from '../lib/imageComposition';
import { persistGalleryPhoto } from '../lib/persistGalleryPhoto';
import { useStudio } from '../store/StudioContext';
import { colors } from '../theme';

export default function LongEditorScreen() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const { photos } = useStudio();
  // Export the same edge-to-edge canvas shown in the preview. Capturing a
  // narrower image inside a full-width ScrollView leaves dark gutters in the
  // saved screenshot on either side.
  // Keep the exact layout width: rounding can leave a fractional uncovered
  // strip on either side on devices whose logical width is not an integer.
  const canvasWidth = Math.max(1, screenWidth);
  const contentHeight = photos.reduce((sum, photo) => sum + canvasWidth * photo.height / Math.max(1, photo.width), 0);
  const scrollRef = useRef<ScrollView>(null);
  const loaded = useRef(new Set<number>());
  const [loadedCount, setLoadedCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [fullPreview, setFullPreview] = useState(false);

  const imageReady = useCallback((index: number) => {
    if (loaded.current.has(index)) return;
    loaded.current.add(index);
    setLoadedCount(loaded.current.size);
  }, []);

  const save = async () => {
    if (saving) return;
    if (photos.length < 2 || !scrollRef.current) {
      Alert.alert('暂时无法保存', '请先选择至少两张照片。');
      return;
    }
    if (loadedCount < photos.length) {
      Alert.alert('照片正在加载', '请稍等片刻后再保存。');
      return;
    }
    setSaving(true);
    let uri: string | undefined;
    try {
      const permission = await MediaLibrary.requestPermissionsAsync(false, ['photo']);
      if (!permission.granted) throw new Error('请允许 PinPic 保存图片到系统相册后重试。');
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const output = fitOutputSize(canvasWidth, contentHeight);
      uri = await captureRef(scrollRef, {
        format: 'jpg',
        quality: 0.96,
        result: 'tmpfile',
        snapshotContentContainer: true,
        width: output.width,
        height: output.height,
        ...(Platform.OS === 'android' ? { fileName: `PinPic_Long_${Date.now()}` } : {}),
      });
      const destination = await persistGalleryPhoto(uri, Platform.OS, MediaLibrary);
      Alert.alert('保存成功', `长图已保存到${destination}。`);
    } catch (cause) {
      Alert.alert('保存失败', cause instanceof Error ? cause.message : '请稍后重试。');
    } finally {
      if (uri) releaseCapture(uri);
      setSaving(false);
    }
  };

  if (photos.length < 2) {
    return <SafeAreaView style={styles.safe}><Text style={styles.hint}>请先选择至少两张照片。</Text></SafeAreaView>;
  }

  const renderPhotos = (width: number) => photos.map((photo, index) => {
    const height = width * photo.height / Math.max(1, photo.width);
    return (
      <Image
        key={`${photo.uri}-${index}`}
        source={{ uri: photo.uri }}
        resizeMode="stretch"
        onLoadEnd={() => imageReady(index)}
        style={{ width, height, backgroundColor: '#FFFFFF' }}
      />
    );
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerButton}><Text style={styles.back}>‹</Text></Pressable>
        <Text style={styles.title}>长图拼接</Text>
        <Pressable onPress={() => void save()} disabled={saving} style={[styles.saveButton, saving && styles.disabled]}><Text style={styles.saveText}>{saving ? '保存中…' : '保存'}</Text></Pressable>
      </View>
      <View style={styles.previewWrap}>
        <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={[styles.content, { width: canvasWidth }]} showsVerticalScrollIndicator>
          {renderPhotos(canvasWidth)}
        </ScrollView>
        <Pressable style={styles.zoomButton} onPress={() => setFullPreview(true)} accessibilityLabel="放大预览">
          <Text style={styles.zoomIcon}>⛶</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>已按选择顺序纵向拼接 · {photos.length} 张照片</Text>
      <Modal visible={fullPreview} animationType="fade" onRequestClose={() => setFullPreview(false)}>
        <SafeAreaView style={styles.modal} edges={['top', 'bottom']}>
          <View style={styles.header}>
            <Pressable onPress={() => setFullPreview(false)} style={styles.headerButton}><Text style={styles.back}>×</Text></Pressable>
            <Text style={styles.title}>长图预览</Text>
            <View style={styles.headerButton} />
          </View>
          <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator>
            {renderPhotos(Math.min(screenWidth - 24, 620))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
      {saving ? <View pointerEvents="none" style={styles.busy}><ActivityIndicator color="#FFFFFF" size="large" /></View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#252528' },
  modal: { flex: 1, backgroundColor: '#151517' },
  header: { minHeight: 58, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerButton: { width: 64, height: 48, justifyContent: 'center' },
  back: { color: '#FFFFFF', fontSize: 36, lineHeight: 42 },
  title: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  saveButton: { minWidth: 76, minHeight: 40, paddingHorizontal: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.violet },
  saveText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  disabled: { opacity: 0.55 },
  previewWrap: { flex: 1, position: 'relative', backgroundColor: '#171719' },
  scroll: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { alignItems: 'stretch', backgroundColor: '#FFFFFF' },
  modalContent: { alignItems: 'center', paddingBottom: 20 },
  zoomButton: { position: 'absolute', right: 16, bottom: 18, width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(20,20,22,0.72)', alignItems: 'center', justifyContent: 'center' },
  zoomIcon: { color: '#FFFFFF', fontSize: 25 },
  hint: { color: '#C5C2CE', fontSize: 12, textAlign: 'center', paddingVertical: 11 },
  busy: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)' },
});
