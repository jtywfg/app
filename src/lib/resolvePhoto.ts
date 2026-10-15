import type { PhotoAsset } from '../types';

export type PhotoChoice = PhotoAsset & { id: string; library?: boolean };

type AssetInfo = { uri: string; localUri?: string; width: number; height: number; filename: string };
type ReadAssetInfo = (id: string, options: { shouldDownloadFromNetwork: boolean }) => Promise<AssetInfo>;

export async function resolvePhoto(choice: PhotoChoice, platform: string, readAssetInfo: ReadAssetInfo): Promise<PhotoAsset> {
  // Android gallery URIs are already local and readable. Full asset info also
  // reads EXIF location data, which is unnecessary for editing.
  if (!choice.library || platform !== 'ios') {
    return { uri: choice.uri, width: choice.width, height: choice.height, fileName: choice.fileName };
  }
  // iOS gallery assets use ph:// URIs; obtain a local file for cropping/export.
  const info = await readAssetInfo(choice.id, { shouldDownloadFromNetwork: true });
  return { uri: info.localUri ?? info.uri, width: info.width, height: info.height, fileName: info.filename };
}
