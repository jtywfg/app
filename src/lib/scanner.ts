import { requireOptionalNativeModule } from 'expo-modules-core';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library/legacy';
import { Platform } from 'react-native';
import type { PhotoAsset } from '../types';
import { persistGalleryPhoto } from './persistGalleryPhoto';
import { validScanQuad, type ScanQuad, type ScanSplit } from './scannerGeometry';

export type ScanFilter = 'original' | 'enhance' | 'clean' | 'gray' | 'bw';
export const SCAN_FILTERS: { id: ScanFilter; label: string }[] = [{ id: 'original', label: '原图' }, { id: 'enhance', label: '清晰增强' }, { id: 'clean', label: '去阴影' }, { id: 'gray', label: '灰度' }, { id: 'bw', label: '黑白' }];
export type ScanPage = { id: string; source: PhotoAsset; quad: ScanQuad; split: ScanSplit; regionIndex: number; detected: boolean; rotation: number; filter: ScanFilter; image: PhotoAsset };
export type ScanDetection = { width: number; height: number; regions: { points: ScanQuad; detected: boolean }[] };
type ScannerModule = {
  detect(uri: string, split: ScanSplit): Promise<ScanDetection>;
  process(uri: string, points: number[], rotation: number, filter: ScanFilter): Promise<PhotoAsset>;
  export(uris: string[], kind: 'pdf' | 'word' | 'long', title: string): Promise<string>;
  saveExport(uri: string, title: string, mime: string, extension: string): Promise<string>;
  removeTemp(uris: string[]): Promise<void>;
};
const native = requireOptionalNativeModule<ScannerModule>('PinPicDocumentScanner');
export function scannerAvailable() { return !!native; }
function scanner() {
  if (!native) throw new Error('扫描需要包含扫描引擎的新版 Android APK，请安装新版后使用。');
  return native;
}
export const detectScan = (uri: string, split: ScanSplit) => scanner().detect(uri, split);
export async function prepareScan(photo: PhotoAsset) {
  const context = ImageManipulator.manipulate(photo.uri);
  if (Math.max(photo.width, photo.height) > 2600) context.resize(photo.width > photo.height ? { width: 2600 } : { height: 2600 });
  const rendered = await context.renderAsync();
  try { return await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.98 }); }
  finally { rendered.release(); context.release(); }
}
export async function renderScan(page: Pick<ScanPage, 'source' | 'quad' | 'rotation' | 'filter'>) {
  if (!validScanQuad(page.quad)) throw new Error('裁切边线交叉或范围过小，请重新调整。');
  return scanner().process(page.source.uri, page.quad.flatMap((p) => [p.x, p.y]), page.rotation, page.filter);
}
export async function exportScans(pages: ScanPage[], format: 'pdf' | 'word' | 'long', title: string) {
  const mimeType = format === 'pdf' ? 'application/pdf' : format === 'word' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'image/jpeg';
  const extension = format === 'pdf' ? 'pdf' : format === 'word' ? 'docx' : 'jpg';
  const uri = await scanner().export(pages.map((p) => p.image.uri), format, title);
  if (Platform.OS === 'android') {
    // Opening a share sheet does not save a file. Persist before reporting success.
    const savedUri = await scanner().saveExport(uri, title, mimeType, extension);
    await scanner().removeTemp([uri]).catch(() => {});
    return savedUri;
  }
  if (!await Sharing.isAvailableAsync()) throw new Error('当前设备无法打开系统分享，请使用保存到相册。');
  await Sharing.shareAsync(uri, { mimeType, dialogTitle: '导出扫描文件', UTI: format === 'pdf' ? 'com.adobe.pdf' : format === 'word' ? 'org.openxmlformats.wordprocessingml.document' : 'public.jpeg' });
  return uri;
}
export async function saveScans(pages: ScanPage[], onProgress: (count: number) => void) {
  const permission = await MediaLibrary.requestPermissionsAsync(Platform.OS === 'ios', ['photo']);
  if (!permission.granted) throw new Error('请允许相册写入权限后重试。');
  let count = 0;
  for (const page of pages) {
    try { await persistGalleryPhoto(page.image.uri, Platform.OS, MediaLibrary); onProgress(++count); }
    catch (error) { throw new Error(`已保存 ${count}/${pages.length} 页。${error instanceof Error ? error.message : '保存失败，请重试剩余页面。'}`); }
  }
}
