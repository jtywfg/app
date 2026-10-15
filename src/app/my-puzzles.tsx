import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Linking, Modal, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Library from 'expo-media-library/legacy';
import { PINPIC_ALBUM } from '../lib/persistGalleryPhoto';

export default function MyPuzzlesScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [assets, setAssets] = useState<Library.Asset[]>([]);
  const [albumId, setAlbumId] = useState<string | null>(null);
  const [permission, setPermission] = useState<'loading' | 'denied' | 'granted'>('loading');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [managing, setManaging] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [preview, setPreview] = useState<Library.Asset | null>(null);
  const cellWidth = Math.floor((width - 48) / 3);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let access = await Library.getPermissionsAsync(false, ['photo']);
      if (!access.granted) access = await Library.requestPermissionsAsync(false, ['photo']);
      if (!access.granted) {
        setPermission('denied');
        setAssets([]);
        return;
      }

      setPermission('granted');
      const albums = await Library.getAlbumsAsync();
      const pinpicAlbum = albums.find((album) => album.title === PINPIC_ALBUM);
      setAlbumId(pinpicAlbum?.id ?? null);

      // Android saves into the PinPic album. iOS may have older exports made
      // before album grouping was added, so show recent permitted photos until
      // the dedicated album has been created by a new save.
      if (Platform.OS === 'android' && !pinpicAlbum) {
        setAssets([]);
        return;
      }
      const result = await Library.getAssetsAsync({
        first: 120,
        ...(pinpicAlbum ? { album: pinpicAlbum.id } : {}),
        mediaType: ['photo'],
        sortBy: [['creationTime', false]],
      });
      setAssets(result.assets);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '作品列表加载失败，请下拉重试。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => void load());
    return () => cancelAnimationFrame(frame);
  }, [load]);

  const toggleSelected = (id: string) => {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const toggleManage = () => {
    if (!managing && !albumId) {
      Alert.alert('暂不可管理', '当前显示的是系统近期照片。保存新拼图后，它会进入 PinPic 专属相册并可在此管理。');
      return;
    }
    setManaging((current) => !current);
    setSelected([]);
  };

  const deleteSelected = () => {
    if (!selected.length) return;
    Alert.alert('删除拼图作品？', `将从系统照片图库删除选中的 ${selected.length} 张作品。`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          void Library.deleteAssetsAsync(selected).then(() => {
            setSelected([]);
            setManaging(false);
            void load();
          }).catch((cause: unknown) => {
            Alert.alert('删除失败', cause instanceof Error ? cause.message : '请稍后重试。');
          });
        },
      },
    ]);
  };

  const renderAsset = ({ item }: { item: Library.Asset }) => {
    const isSelected = selected.includes(item.id);
    return (
      <Pressable
        onPress={() => managing ? toggleSelected(item.id) : setPreview(item)}
        style={[styles.cell, { width: cellWidth, height: cellWidth }]}
        accessibilityLabel={managing ? `${isSelected ? '取消选择' : '选择'}拼图作品` : '预览拼图作品'}
      >
        <Image source={{ uri: item.uri }} style={styles.thumbnail} resizeMode="cover" />
        {managing ? <View style={[styles.selection, isSelected && styles.selectionActive]}><Text style={styles.selectionText}>{isSelected ? '✓' : ''}</Text></View> : null}
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerSide} accessibilityLabel="关闭我的拼图">
          <Text style={styles.close}>×</Text>
        </Pressable>
        <Text style={styles.headerTitle} accessibilityRole="header">我的拼图</Text>
        <Pressable onPress={toggleManage} style={[styles.headerSide, styles.headerRight]} accessibilityRole="button">
          <Text style={styles.manage}>{managing ? '完成' : '管理'}</Text>
        </Pressable>
      </View>

      {permission === 'loading' ? (
        <View style={styles.state}><ActivityIndicator color="#FFFFFF" /></View>
      ) : permission === 'denied' ? (
        <View style={styles.state}>
          <Text style={styles.emptyTitle}>需要相册权限</Text>
          <Text style={styles.emptyHint}>允许读取相册后，才能显示保存的拼图作品。</Text>
          <Pressable onPress={() => void Linking.openSettings()} style={styles.stateButton}><Text style={styles.stateButtonText}>打开系统设置</Text></Pressable>
        </View>
      ) : (
        <FlatList
          data={assets}
          numColumns={3}
          keyExtractor={(item) => item.id}
          renderItem={renderAsset}
          columnWrapperStyle={styles.row}
          contentContainerStyle={[styles.grid, assets.length === 0 && styles.emptyGrid]}
          refreshing={loading}
          onRefresh={() => void load()}
          ListEmptyComponent={
            <View style={styles.state}>
              <View style={styles.emptyIcon}><Text style={styles.emptyGlyph}>▦</Text></View>
              <Text style={styles.emptyTitle}>{error ? '加载失败' : '还没有拼图作品'}</Text>
              <Text style={styles.emptyHint}>{error || '保存后的拼图会显示在这里。'}</Text>
              {error ? <Pressable onPress={() => void load()} style={styles.stateButton}><Text style={styles.stateButtonText}>重试</Text></Pressable> : null}
            </View>
          }
          ListFooterComponent={assets.length ? <Text style={styles.footerHint}>{loading ? '正在更新…' : `${assets.length} 张作品`}</Text> : null}
        />
      )}

      {managing ? (
        <View style={styles.manageBar}>
          <Text style={styles.selectedCount}>已选择 {selected.length} 张</Text>
          <Pressable onPress={deleteSelected} disabled={!selected.length} style={[styles.deleteButton, !selected.length && styles.deleteDisabled]}>
            <Text style={styles.deleteText}>删除</Text>
          </Pressable>
        </View>
      ) : null}

      <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <Pressable style={styles.previewBackdrop} onPress={() => setPreview(null)} accessibilityLabel="关闭预览">
          {preview ? <Image source={{ uri: preview.uri }} style={styles.previewImage} resizeMode="contain" /> : null}
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#2D2D2D' },
  header: { height: 64, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerSide: { width: 64, height: 48, justifyContent: 'center' },
  headerRight: { alignItems: 'flex-end' },
  headerTitle: { position: 'absolute', left: 90, right: 90, textAlign: 'center', color: '#F5F5F5', fontSize: 15, fontWeight: '600' },
  close: { color: '#F4F4F4', fontSize: 38, lineHeight: 44, fontWeight: '300' },
  manage: { color: '#F4F4F4', fontSize: 16 },
  grid: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 20 },
  emptyGrid: { flexGrow: 1 },
  row: { justifyContent: 'space-between' },
  cell: { marginBottom: 10, padding: 4, backgroundColor: '#F1F1F1' },
  thumbnail: { flex: 1, backgroundColor: '#444444' },
  selection: { position: 'absolute', top: 7, right: 7, width: 23, height: 23, borderRadius: 12, borderWidth: 2, borderColor: '#FFFFFF', backgroundColor: 'rgba(35,35,35,0.42)', alignItems: 'center', justifyContent: 'center' },
  selectionActive: { backgroundColor: '#806CF3', borderColor: '#FFFFFF' },
  selectionText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', lineHeight: 18 },
  state: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 36, gap: 10 },
  emptyIcon: { width: 62, height: 62, borderRadius: 19, backgroundColor: '#3B3B3B', alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
  emptyGlyph: { color: '#9B8AF5', fontSize: 31 },
  emptyTitle: { color: '#F4F4F4', fontSize: 17, fontWeight: '700' },
  emptyHint: { color: '#B3B3B3', fontSize: 13, textAlign: 'center', lineHeight: 19 },
  stateButton: { marginTop: 8, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 18, backgroundColor: '#766CF8' },
  stateButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  footerHint: { color: '#9C9C9C', fontSize: 11, textAlign: 'center', paddingVertical: 13 },
  manageBar: { minHeight: 62, paddingHorizontal: 20, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#222222' },
  selectedCount: { color: '#E7E7E7', fontSize: 13 },
  deleteButton: { minWidth: 74, paddingHorizontal: 17, paddingVertical: 9, borderRadius: 18, backgroundColor: '#E8505B', alignItems: 'center' },
  deleteDisabled: { opacity: 0.42 },
  deleteText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  previewBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', justifyContent: 'center', alignItems: 'center', padding: 14 },
  previewImage: { width: '100%', height: '88%' },
});
