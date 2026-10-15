import * as ImagePicker from 'expo-image-picker';
import type { PhotoAsset } from '../types';

export async function pickPhotos(multiple: boolean): Promise<PhotoAsset[] | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: multiple,
    selectionLimit: multiple ? 9 : 1,
    allowsEditing: false,
    quality: 1,
    exif: false,
  });

  if (result.canceled || result.assets.length === 0) {
    return null;
  }

  return result.assets.slice(0, multiple ? 9 : 1).map((asset) => ({
    uri: asset.uri,
    width: asset.width || 1200,
    height: asset.height || 1200,
    fileName: asset.fileName,
  }));
}
