import type { Asset, Album, PagedInfo } from 'expo-media-library/legacy';

export const PINPIC_ALBUM = 'PinPic';

type SaveLibrary = {
  createAssetAsync: (localUri: string) => Promise<Asset>;
  createAlbumAsync: (name: string, asset?: string | Asset, copyAsset?: boolean, initialAssetLocalUri?: string) => Promise<Album>;
  getAlbumsAsync?: () => Promise<Album[]>;
  addAssetsToAlbumAsync?: (asset: string | Asset, album: string | Album, copy?: boolean) => Promise<boolean>;
  getAssetsAsync: (options: {
    first: number;
    album: string;
    mediaType: 'photo'[];
    sortBy: [['creationTime', false]];
  }) => Promise<PagedInfo<Asset>>;
};

export async function persistGalleryPhoto(
  uri: string,
  platform: string,
  library: SaveLibrary
): Promise<string> {
  if (platform !== 'android') {
    const asset = await library.createAssetAsync(uri);
    if (!asset?.id) throw new Error('系统照片图库未确认保存图片。');
    // Keep iOS exports in a named album when read access is available. The image
    // itself has already been saved, so album indexing must not turn a successful
    // save into a failure for users who granted add-only/limited access.
    if (library.getAlbumsAsync && library.addAssetsToAlbumAsync) {
      try {
        const albums = await library.getAlbumsAsync();
        const pinpicAlbum = albums.find((item) => item.title === PINPIC_ALBUM);
        if (pinpicAlbum) {
          await library.addAssetsToAlbumAsync(asset, pinpicAlbum, false);
        } else {
          await library.createAlbumAsync(PINPIC_ALBUM, asset, false);
        }
        return `系统照片图库的「${PINPIC_ALBUM}」相册`;
      } catch {
        // Keep the original add-only save behavior if album access is unavailable.
      }
    }
    return '系统照片图库';
  }

  // Save through the Android media scanner into a predictable public DCIM album.
  const album = await library.createAlbumAsync(PINPIC_ALBUM, undefined, true, uri);
  if (!album?.id) throw new Error('系统图库未能创建 PinPic 相册。');

  // Do not report success until the newly captured file is queryable in MediaStore.
  const fileName = decodeURIComponent(uri.split('/').pop() ?? '');
  const saved = await library.getAssetsAsync({
    first: 20,
    album: album.id,
    mediaType: ['photo'],
    sortBy: [['creationTime', false]],
  });
  if (!saved.assets.some((asset) => asset.filename === fileName)) {
    throw new Error('图片已复制，但系统图库尚未确认登记。请稍后重试。');
  }
  return `系统图库的「${PINPIC_ALBUM}」相册`;
}
