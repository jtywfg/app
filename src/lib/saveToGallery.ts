import { Alert, Platform, type View } from 'react-native';
import * as MediaLibrary from 'expo-media-library/legacy';
import { captureRef } from 'react-native-view-shot';
import { persistGalleryPhoto } from './persistGalleryPhoto';

export async function saveViewToGallery(
  view: View | null,
  aspectRatio: number,
  onBusy?: (busy: boolean) => void
) {
  if (!view) {
    throw new Error('画布还没有准备好，请稍后再试。');
  }

  onBusy?.(true);
  try {
    const permission = await MediaLibrary.requestPermissionsAsync(Platform.OS === 'ios', ['photo']);
    if (!permission.granted) {
      Alert.alert('需要相册权限', '请允许 PinPic 保存图片到系统相册后重试。');
      return false;
    }

    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

    const width = 1200;
    const height = Math.round(width / aspectRatio);
    const uri = await captureRef(view, {
      format: 'jpg',
      quality: 0.98,
      result: 'tmpfile',
      ...(Platform.OS === 'android' ? { fileName: `PinPic_${Date.now()}` } : {}),
      width,
      height,
    });
    const destination = await persistGalleryPhoto(uri, Platform.OS, MediaLibrary);
    Alert.alert('保存成功', `作品已保存到${destination}。`);
    return true;
  } finally {
    onBusy?.(false);
  }
}
