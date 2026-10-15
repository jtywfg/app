import { requireOptionalNativeModule } from 'expo-modules-core';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { PhotoAsset } from '../types';
import { NO_PORTRAIT_EFFECTS, type PortraitEffects } from './portraitEffects';
import { Platform } from 'react-native';

export type IDPhotoSpec = { id: string; name: string; width: number; height: number; mmWidth: number; mmHeight: number; category: string };
export const ID_PHOTO_SPECS: IDPhotoSpec[] = [
  { id: 'one', name: '一寸', width: 295, height: 413, mmWidth: 25, mmHeight: 35, category: '常用尺寸' },
  { id: 'small-two', name: '小二寸', width: 413, height: 531, mmWidth: 35, mmHeight: 45, category: '常用尺寸' },
  { id: 'five', name: '五寸', width: 1051, height: 1500, mmWidth: 89, mmHeight: 127, category: '常用尺寸' },
  { id: 'two', name: '二寸', width: 413, height: 579, mmWidth: 35, mmHeight: 49, category: '常用尺寸' },
  { id: 'small-one', name: '小一寸', width: 260, height: 378, mmWidth: 22, mmHeight: 32, category: '常用尺寸' },
  { id: 'three', name: '三寸', width: 650, height: 992, mmWidth: 55, mmHeight: 84, category: '常用尺寸' },
  { id: 'large-one', name: '大一寸', width: 390, height: 567, mmWidth: 33, mmHeight: 48, category: '常用尺寸' },
  { id: 'civil', name: '公务员考试', width: 413, height: 531, mmWidth: 35, mmHeight: 45, category: '考试证照' },
  { id: 'teacher', name: '教师资格考试', width: 295, height: 413, mmWidth: 25, mmHeight: 35, category: '考试证照' },
  { id: 'passport', name: '中国护照', width: 390, height: 567, mmWidth: 33, mmHeight: 48, category: '护照签证' },
  { id: 'visa', name: '美国签证', width: 602, height: 602, mmWidth: 51, mmHeight: 51, category: '护照签证' },
  { id: 'social', name: '社保证件照', width: 358, height: 441, mmWidth: 30, mmHeight: 37, category: '个人证件' },
];
export const ID_BACKGROUNDS = [
  ['#438EFF', '#FFFFFF', '#ED3026', '#346B9F', '#9FC9FA', '#405666'],
  ['#1756A5', '#E7EAF3', '#951D31', '#124F70', '#D3DAE2', '#252F42'],
  ['#F9DDE7', '#DCD6F9', '#CBEBE2', '#F7EBCF', '#DBEEFB', '#F5DCC8'],
];
export type FaceBox = { x: number; y: number; width: number; height: number };
export type FaceCheck = { valid: boolean; reason: string; face?: FaceBox };
type NativeIDPhoto = {
  detectFace(uri: string): Promise<FaceCheck>;
  replaceBackground(uri: string, color: string, beauty: number, makeup: number): Promise<PhotoAsset>;
  replaceBackgroundEnhanced(uri: string, color: string, effects: PortraitEffects): Promise<PhotoAsset>;
};
const native = requireOptionalNativeModule<NativeIDPhoto>('PinPicIDPhotoDetector');

export function getIDPhotoSpec(id?: string) {
  return ID_PHOTO_SPECS.find((spec) => spec.id === id) ?? ID_PHOTO_SPECS[0];
}

export async function normalizeIDPhoto(photo: PhotoAsset): Promise<PhotoAsset> {
  const context = ImageManipulator.manipulate(photo.uri);
  if (Math.max(photo.width, photo.height) > 1400) {
    context.resize(photo.width >= photo.height ? { width: 1200 } : { height: 1200 });
  }
  const image = await context.renderAsync();
  try { return await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.98 }); }
  finally { image.release(); context.release(); }
}

export async function detectIDPhoto(photo: PhotoAsset) {
  if (!native) throw new Error('当前安装包未包含证件照检测模块，请安装新版 APK 后再使用。');
  return native.detectFace(photo.uri);
}

export function getPortraitCrop(width: number, height: number, face: FaceBox, ratio: number) {
  const targetHeight = Math.min(height, Math.max(face.height * height / 0.42, face.width * width / 0.48 / ratio));
  const cropHeight = Math.min(targetHeight, width / ratio);
  const cropWidth = cropHeight * ratio;
  return {
    originX: Math.max(0, Math.min(width - cropWidth, (face.x + face.width / 2) * width - cropWidth / 2)),
    originY: Math.max(0, Math.min(height - cropHeight, face.y * height - cropHeight * 0.15)),
    width: Math.max(1, Math.floor(cropWidth)), height: Math.max(1, Math.floor(cropHeight)),
  };
}

export async function cropIDPhoto(photo: PhotoAsset, face: FaceBox, spec: IDPhotoSpec) {
  const context = ImageManipulator.manipulate(photo.uri);
  const crop = getPortraitCrop(photo.width, photo.height, face, spec.width / spec.height);
  context.crop(crop).resize({ width: Math.min(900, spec.width * 2) });
  const image = await context.renderAsync();
  try { return await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.98 }); }
  finally { image.release(); context.release(); }
}

export async function replaceIDBackground(photo: PhotoAsset, color: string, effects: PortraitEffects = NO_PORTRAIT_EFFECTS) {
  if (!native) throw new Error('当前安装包未包含换底色模块，请安装新版 APK 后重试。');
  if (Platform.OS === 'ios') return native.replaceBackground(photo.uri, color, Math.round(effects.brighten / 34), Math.round(effects.tone / 34));
  if (typeof native.replaceBackgroundEnhanced !== 'function') throw new Error('当前安装包需要更新，请安装含精细抠图与美颜增强的新版 APK。');
  return native.replaceBackgroundEnhanced(photo.uri, color, effects);
}

export function getPrintLayout(spec: IDPhotoSpec) {
  const width = 1800;
  const height = 1200;
  const gap = 36;
  const columns = Math.max(1, Math.floor((width - 100 + gap) / (spec.width + gap)));
  const rows = Math.max(1, Math.floor((height - 100 + gap) / (spec.height + gap)));
  const x = (width - columns * spec.width - (columns - 1) * gap) / 2;
  const y = (height - rows * spec.height - (rows - 1) * gap) / 2;
  const slots = Array.from({ length: columns * rows }, (_, i) => ({ x: x + i % columns * (spec.width + gap), y: y + Math.floor(i / columns) * (spec.height + gap), width: spec.width, height: spec.height }));
  return { width, height, slots };
}
