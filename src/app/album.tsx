import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, FlatList, Image, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Library from 'expo-media-library/legacy';
import * as ImagePicker from 'expo-image-picker';
import { useStudio } from '../store/StudioContext';
import { resolvePhoto, type PhotoChoice as Choice } from '../lib/resolvePhoto';
import { colors } from '../theme';

export default function AlbumScreen() {
  const router = useRouter();
  const { spec } = useLocalSearchParams<{ spec?: string }>();
  const { mode, setPhotos } = useStudio();
  const idPhoto = mode === 'idphoto' || mode === 'idphoto-background';
  const single = mode === 'single' || mode === 'nine' || idPhoto;
  const maxSelection = mode === 'long' ? 20 : 9;
  const tabsRef = useRef<ScrollView>(null);
  const { width } = useWindowDimensions();
  const [assets, setAssets] = useState<Library.Asset[]>([]);
  const [albums, setAlbums] = useState<Library.Album[]>([]);
  const [albumId, setAlbumId] = useState<string | undefined>();
  const albumIdRef = useRef<string | undefined>(undefined);
  const [selected, setSelected] = useState<Choice[]>([]);
  const [permission, setPermission] = useState<'loading' | 'denied' | 'limited' | 'all'>('loading');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const page = useRef({ after: undefined as string | undefined, more: true, loading: false, generation: 0 });

  const load = useCallback(async (reset = false) => {
    if (!reset && (page.current.loading || !page.current.more)) return;
    const generation = reset ? ++page.current.generation : page.current.generation;
    page.current.loading = true;
    setLoading(true);
    setError('');
    try {
      const result = await Library.getAssetsAsync({ first: 80, after: reset ? undefined : page.current.after, album: albumIdRef.current, mediaType: ['photo'], sortBy: [['creationTime', false]] });
      if (generation !== page.current.generation) return;
      setAssets((current) => reset ? result.assets : [...current, ...result.assets.filter((asset) => !current.some((old) => old.id === asset.id))]);
      page.current.after = result.endCursor;
      page.current.more = result.hasNextPage;
    } catch (cause) {
      if (generation === page.current.generation) setError(cause instanceof Error ? cause.message : '相册加载失败，请重试。');
    } finally {
      if (generation === page.current.generation) { page.current.loading = false; setLoading(false); }
    }
  }, []);

  const refreshPermission = useCallback(async (ask: boolean) => {
    try {
      const response = ask ? await Library.requestPermissionsAsync(false, ['photo']) : await Library.getPermissionsAsync(false, ['photo']);
      if (!response.granted) { setPermission('denied'); return; }
      setPermission(response.accessPrivileges === 'limited' ? 'limited' : 'all');
      setAlbums(await Library.getAlbumsAsync());
      await load(true);
    } catch (cause) { setPermission('denied'); setError(cause instanceof Error ? cause.message : '无法读取相册'); }
  }, [load]);

  useEffect(() => {
    // Android can initially lay out a horizontal ScrollView with stale native
    // content bounds; explicitly return to the first album tab after loading.
    const frame = requestAnimationFrame(() => tabsRef.current?.scrollTo({ x: 0, animated: false }));
    return () => cancelAnimationFrame(frame);
  }, [albums]);

  useEffect(() => {
    const state = page.current;
    const frame = requestAnimationFrame(() => void refreshPermission(true));
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') void refreshPermission(false); });
    return () => { cancelAnimationFrame(frame); subscription.remove(); state.generation++; };
  }, [refreshPermission]);

  const resolve = (choice: Choice) => resolvePhoto(choice, Platform.OS, Library.getAssetInfoAsync);

  const selectAlbum = (id: string | undefined) => {
    albumIdRef.current = id;
    setAlbumId(id);
    page.current.after = undefined;
    page.current.more = true;
    void load(true);
  };

  const openSingle = async (choice: Choice) => {
    if (busy) return;
    setBusy(true);
    try {
      setPhotos([await resolve(choice)]);
      if (idPhoto) router.push({ pathname: '/idphoto-detect', params: { spec, backgroundOnly: mode === 'idphoto-background' ? '1' : '0' } });
      else router.push(mode === 'nine' ? '/grid-editor' : '/photo-editor');
    }
    catch (cause) { Alert.alert('无法读取照片', cause instanceof Error ? cause.message : '请重试'); }
    finally { setBusy(false); }
  };

  const toggle = (choice: Choice) => {
    if (single) { void openSingle(choice); return; }
    setSelected((current) => {
      if (current.some((item) => item.id === choice.id)) return current.filter((item) => item.id !== choice.id);
      if (current.length >= maxSelection) { Alert.alert(`最多选择 ${maxSelection} 张`, '请移除一张后继续选择。'); return current; }
      return [...current, choice];
    });
  };

  const next = async () => {
    if (selected.length < 2 || busy) return;
    setBusy(true);
    try {
      setPhotos(await Promise.all(selected.map(resolve)));
      router.push(mode === 'free' ? '/free-editor' : mode === 'long' ? '/long-editor' : '/templates');
    } catch (cause) { Alert.alert('无法读取照片', cause instanceof Error ? cause.message : '请重试'); }
    finally { setBusy(false); }
  };

  const takePhoto = async () => {
    if (busy) return;
    if (idPhoto) { router.push({ pathname: '/idphoto-camera', params: { spec, backgroundOnly: mode === 'idphoto-background' ? '1' : '0' } }); return; }
    try {
      const access = await ImagePicker.requestCameraPermissionsAsync();
      if (!access.granted) { Alert.alert('需要相机权限', '请在系统设置中允许相机访问。', [{ text: '取消' }, { text: '设置', onPress: () => void Linking.openSettings() }]); return; }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
      if (result.canceled) return;
      const asset = result.assets[0];
      toggle({ id: `camera-${Date.now()}`, uri: asset.uri, width: asset.width, height: asset.height });
    } catch (cause) { Alert.alert('无法拍照', cause instanceof Error ? cause.message : '请重试'); }
  };

  const columns = idPhoto ? 3 : 4;
  const cellWidth = (width - (columns - 1) * 2) / columns;
  const data: (Library.Asset | null)[] = [null, ...assets];
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}><Pressable onPress={() => router.back()} accessibilityLabel="返回"><Text style={styles.close}>×</Text></Pressable><Text style={styles.title}>{idPhoto ? '全部图片' : '相册'}</Text><Text style={styles.mode}>{idPhoto ? '证件照' : mode === 'nine' ? '九宫格' : single ? '编辑' : '多选'}</Text></View>
      <ScrollView ref={tabsRef} horizontal style={styles.tabs} contentContainerStyle={styles.tabItems} showsHorizontalScrollIndicator={false} onContentSizeChange={() => { if (!albumId) tabsRef.current?.scrollTo({ x: 0, animated: false }); }}>
        {[{ id: undefined, title: idPhoto ? '全部图片' : single ? 'MIXOO · 全部照片' : '最近项目' }, ...albums].map((album) => <Pressable key={album.id ?? 'all'} style={styles.tabButton} onPress={() => { selectAlbum(album.id); tabsRef.current?.scrollTo({ x: 0, animated: false }); }}><Text numberOfLines={1} style={[styles.tab, albumId === album.id && styles.tabActive]}>{album.title}</Text></Pressable>)}
      </ScrollView>
      {permission === 'limited' ? <Pressable style={styles.notice} onPress={() => void Library.presentPermissionsPickerAsync(['photo']).then(() => refreshPermission(false)).catch(() => Linking.openSettings())}><Text style={styles.noticeText}>当前仅可访问部分照片，点击管理权限；在系统设置中允许全部照片。</Text></Pressable> : null}
      {permission === 'loading' ? <View style={styles.empty}><ActivityIndicator color={colors.violet} /></View> : permission === 'denied' ? <View style={styles.empty}><Text style={styles.message}>请允许访问照片，以显示手机相册。{error}</Text><Pressable onPress={() => void Linking.openSettings()}><Text style={styles.link}>打开系统设置</Text></Pressable><Pressable onPress={() => void takePhoto()}><Text style={styles.link}>相机拍照</Text></Pressable></View> : (
        <FlatList key={columns} data={data} numColumns={columns} keyExtractor={(item) => item?.id ?? 'camera'} onEndReached={() => void load()} onEndReachedThreshold={0.6} refreshing={loading} onRefresh={() => void load(true)} extraData={selected} renderItem={({ item }) => {
          if (!item) return <Pressable style={[styles.cell, styles.camera, { width: cellWidth, height: cellWidth }]} onPress={() => void takePhoto()}><Text style={styles.cameraIcon}>◎</Text><Text style={styles.message}>相机</Text></Pressable>;
          const index = selected.findIndex((choice) => choice.id === item.id);
          return <Pressable disabled={busy} onPress={() => toggle({ id: item.id, uri: item.uri, width: item.width, height: item.height, library: true })} style={[styles.cell, { width: cellWidth, height: cellWidth }]}><Image source={{ uri: item.uri }} style={StyleSheet.absoluteFill} />{index >= 0 ? <View style={styles.selectedShade}><Text style={styles.number}>{index + 1}</Text></View> : null}</Pressable>;
        }} ListFooterComponent={error ? <Pressable onPress={() => void load(true)}><Text style={styles.message}>{error} · 点击重试</Text></Pressable> : loading ? <ActivityIndicator color={colors.violet} /> : assets.length === 0 ? <Text style={styles.message}>此相册暂无照片</Text> : null} />
      )}
      {!single ? <View style={styles.bottom}><View style={styles.bottomHeader}><Text style={styles.message}>已选择 {selected.length} 张照片</Text><Pressable disabled={selected.length < 2 || busy} style={[styles.next, (selected.length < 2 || busy) && styles.disabled]} onPress={() => void next()}><Text style={styles.message}>{busy ? '读取中…' : '下一步 ›'}</Text></Pressable></View><ScrollView horizontal contentContainerStyle={styles.selectedRow}>{selected.map((choice) => <Pressable key={choice.id} onPress={() => toggle(choice)} style={styles.thumb}><Image source={{ uri: choice.uri }} style={StyleSheet.absoluteFill} /><Text style={styles.remove}>−</Text></Pressable>)}</ScrollView><Text style={styles.hint}>选择 2–{maxSelection} 张 · 点击下方照片移除</Text></View> : null}
      {busy && single ? <ActivityIndicator color={colors.violet} style={styles.busy} /> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#252528' }, header: { height: 58, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, close: { fontSize: 36, color: '#fff' }, title: { color: '#fff', fontSize: 19 }, mode: { color: '#aaa', fontSize: 12 }, tabs: { height: 54, flexGrow: 0, flexShrink: 0 }, tabItems: { gap: 24, paddingHorizontal: 20, alignItems: 'stretch', minHeight: 54 }, tabButton: { height: 54, justifyContent: 'center', flexShrink: 0 }, tab: { color: '#999', fontSize: 14, lineHeight: 20 }, tabActive: { color: '#aaa0ff', borderBottomWidth: 2, borderColor: '#aaa0ff', paddingBottom: 7 }, cell: { marginRight: 2, marginBottom: 2 }, camera: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#363639', gap: 6 }, cameraIcon: { fontSize: 36, color: '#fff' }, selectedShade: { ...StyleSheet.absoluteFill, borderWidth: 3, borderColor: '#a69aff', backgroundColor: 'rgba(120,100,240,0.18)' }, number: { alignSelf: 'flex-end', backgroundColor: colors.violet, color: '#fff', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 14 }, bottom: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#222225' }, bottomHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, message: { color: '#fff', fontSize: 14, paddingVertical: 8 }, next: { paddingHorizontal: 20, backgroundColor: colors.violet, borderRadius: 5 }, disabled: { opacity: 0.4 }, selectedRow: { gap: 13, paddingTop: 15, paddingBottom: 5, minHeight: 85 }, thumb: { width: 64, height: 64 }, remove: { position: 'absolute', top: -6, right: -6, backgroundColor: '#f25566', color: '#fff', fontSize: 18, width: 22, height: 22, textAlign: 'center', borderRadius: 11, overflow: 'hidden' }, hint: { color: '#aaa', fontSize: 11, paddingTop: 5 }, empty: { flex: 1, padding: 25, justifyContent: 'center' }, link: { color: '#b5aaff', paddingVertical: 12 }, notice: { backgroundColor: '#423955', padding: 9 }, noticeText: { color: '#eee', fontSize: 12 }, busy: { position: 'absolute', top: '50%', left: '50%' },
});
