import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, BackHandler, Image, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import Svg, { Line, Polygon } from 'react-native-svg';
import { ScanCropEditor } from '../components/ScanCropEditor';
import { ScanPageGrid } from '../components/ScanPageGrid';
import { ActionGlyph } from '../components/ActionGlyph';
import { dropScanPage, moveSelectedPages } from '../lib/scanPageOrder';
import { detectScan, prepareScan, renderScan, saveScans, scannerAvailable, SCAN_FILTERS, exportScans, type ScanDetection, type ScanFilter, type ScanPage } from '../lib/scanner';
import { defaultScanQuads, fullScanQuad, type ScanQuad, type ScanSplit } from '../lib/scannerGeometry';
import type { PhotoAsset } from '../types';

type Stage = 'camera' | 'edit' | 'crop' | 'preview';
const ACCENT = '#1CCBB0';
const MAX_PAGES = 50;
function removeCapture(uri?: string) { if (uri) { try { new File(uri).delete(); } catch { /* Camera cache may already have been reclaimed. */ } } }
function ScanTool({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable disabled={disabled} onPress={onPress} style={[styles.tool, disabled && styles.disabled]}><Text style={styles.toolText}>{label}</Text></Pressable>;
}

export default function ScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [stage, setStage] = useState<Stage>('camera');
  const [mode, setMode] = useState<'smart' | 'book'>('smart');
  const [smartMulti, setSmartMulti] = useState(false);
  const [bookDouble, setBookDouble] = useState(false);
  const [axis, setAxis] = useState<'vertical' | 'horizontal'>('horizontal');
  const [pages, setPages] = useState<ScanPage[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState(`扫描 ${new Date().toLocaleDateString('zh-CN')}`);
  const [busy, setBusy] = useState('');
  const [flash, setFlash] = useState(false);
  const [ready, setReady] = useState(false);
  const [focused, setFocused] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [live, setLive] = useState<ScanDetection | null>(null);
  const [autoEdge, setAutoEdge] = useState(true);
  const [crop, setCrop] = useState<ScanQuad>(fullScanQuad());
  const [allFilters, setAllFilters] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [retake, setRetake] = useState<string | null>(null);
  const camera = useRef<CameraView>(null);
  const cameraLock = useRef(false);
  const operation = useRef(false);
  const alive = useRef(true);
  const wantCapture = useRef(false);
  const captureAction = useRef<() => Promise<void>>(async () => {});
  const previewSequence = useRef(0);
  const split: ScanSplit = mode === 'book' && bookDouble && !retake ? axis : 'none';
  const current = pages[index];
  const refs = useRef({ split, stage, busy, ready });
  useLayoutEffect(() => { refs.current = { split, stage, busy, ready }; });
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { const listener = AppState.addEventListener('change', (state) => setForeground(state === 'active')); return () => listener.remove(); }, []);
  useFocusEffect(useCallback(() => { setFocused(true); return () => { setFocused(false); setReady(false); }; }, []));

  const report = (error: unknown) => Alert.alert('扫描未完成', error instanceof Error ? error.message : '处理失败，请重试。');
  const confirmExit = useCallback(() => {
    if (operation.current) return;
    if (stage === 'crop') { setStage('edit'); return; }
    if (stage === 'edit') { setStage('preview'); return; }
    if (stage === 'preview') { setStage('camera'); setReady(false); return; }
    if (retake) { setRetake(null); setStage('edit'); return; }
    if (!pages.length) { router.back(); return; }
    Alert.alert('退出扫描？', '未导出的扫描页将从当前会话中移除，请先导出或保存到相册。', [{ text: '继续扫描', style: 'cancel' }, { text: '退出', style: 'destructive', onPress: () => router.back() }]);
  }, [stage, pages.length, retake, router]);
  useFocusEffect(useCallback(() => { const sub = BackHandler.addEventListener('hardwareBackPress', () => { confirmExit(); return true; }); return () => sub.remove(); }, [confirmExit]));
  // Preview sampling uses the same edge detector as the full resolution photo.
  // A mutex prevents concurrent camera captures; a shutter tap is queued until
  // the current low-resolution analysis finishes.
  useEffect(() => {
    const sequence = ++previewSequence.current;
    if (stage !== 'camera' || !focused || !foreground || !ready || !autoEdge || !scannerAvailable()) return;
    let canceled = false;
    const timer = setInterval(() => {
      if (canceled || cameraLock.current || operation.current || !camera.current) return;
      cameraLock.current = true;
      void (async () => {
        let uri: string | undefined;
        try {
          const shot = await camera.current!.takePictureAsync({ quality: 0.18, shutterSound: false, exif: false }); uri = shot.uri;
          const detection = await detectScan(uri, refs.current.split);
          if (!canceled && alive.current && sequence === previewSequence.current) setLive(detection);
        } catch { if (!canceled && alive.current) setLive(null); }
        finally { removeCapture(uri); cameraLock.current = false; if (wantCapture.current && !canceled) { wantCapture.current = false; void captureAction.current(); } }
      })();
    }, 2200);
    return () => { canceled = true; wantCapture.current = false; clearInterval(timer); };
  }, [stage, focused, foreground, ready, autoEdge, split]);

  const run = async (message: string, work: () => Promise<void>) => {
    if (operation.current) return;
    operation.current = true; setBusy(message);
    try { await work(); } catch (error) { if (alive.current) report(error); }
    finally { operation.current = false; if (alive.current) setBusy(''); }
  };
  const addPhotos = async (photos: PhotoAsset[], replacement: string | null, captureSplit: ScanSplit) => {
    const additions: ScanPage[] = [];
    for (let i = 0; i < photos.length; i++) {
      setBusy(`识别并裁切 ${i + 1}/${photos.length}`);
      const source = await prepareScan(photos[i]);
      const detection = await detectScan(source.uri, captureSplit);
      for (let regionIndex = 0; regionIndex < detection.regions.length; regionIndex++) {
        const region = detection.regions[regionIndex];
        const page = { id: `${Date.now()}-${i}-${additions.length}`, source, quad: region.points, split: captureSplit, regionIndex, detected: region.detected, rotation: captureSplit === 'horizontal' ? 3 : 0, filter: 'enhance' as ScanFilter };
        const image = await renderScan(page); additions.push({ ...page, image });
      }
    }
    if (!alive.current) return;
    const updated = replacement ? pages.map((p) => p.id === replacement ? additions[0] : p) : [...pages, ...additions];
    setPages(updated); setSelected(updated.map((p) => p.id)); setLive(null);
    if (replacement || (mode === 'smart' && !smartMulti)) { setIndex(replacement ? Math.max(0, pages.findIndex((p) => p.id === replacement)) : pages.length); setStage('edit'); }
    setRetake(null);
  };
  useLayoutEffect(() => { captureAction.current = async () => {
    if (!refs.current.ready || refs.current.stage !== 'camera' || operation.current || !camera.current) return;
    if (cameraLock.current) { wantCapture.current = true; return; }
    if (!retake && pages.length + (split === 'none' ? 1 : 2) > MAX_PAGES) { Alert.alert('页数已满', '每次最多扫描 50 页，请先导出后新建扫描。'); return; }
    cameraLock.current = true;
    await run('正在拍摄…', async () => {
      let uri: string | undefined;
      try { const photo = await camera.current!.takePictureAsync({ quality: 1, shutterSound: true, exif: false }); uri = photo.uri; await addPhotos([photo], retake, split); }
      finally { cameraLock.current = false; removeCapture(uri); }
    });
  }; });
  const importPhotos = async () => {
    if (cameraLock.current) { Alert.alert('正在识别边缘', '请稍后再导入，或关闭自动识边。'); return; }
    await run('正在打开相册…', async () => {
      const remaining = retake ? 1 : Math.floor((MAX_PAGES - pages.length) / (split === 'none' ? 1 : 2));
      if (remaining < 1) throw new Error('已达到 50 页上限，请先导出。');
      const single = !!retake || (mode === 'smart' && !smartMulti);
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: !single, selectionLimit: single ? 1 : remaining, quality: 1, orderedSelection: true });
      if (!result.canceled) await addPhotos(result.assets.slice(0, single ? 1 : remaining), retake, split);
    });
  };
  const updatePage = async (changes: Partial<Pick<ScanPage, 'filter' | 'rotation' | 'quad'>>, applyAll = false) => {
    await run('正在处理扫描页…', async () => {
      const next = [...pages];
      for (let i = 0; i < next.length; i++) if (applyAll || i === index) { const page = { ...next[i], ...changes }; next[i] = { ...page, image: await renderScan(page) }; }
      setPages(next);
    });
  };
  const openEdit = (i: number) => { setIndex(i); setStage('edit'); };
  const deleteSelected = () => Alert.alert(`删除选中的 ${selected.length} 页？`, '其余扫描页会保留。', [{ text: '取消', style: 'cancel' }, { text: '删除', style: 'destructive', onPress: () => { const remaining = pages.filter((page) => !selected.includes(page.id)); setPages(remaining); setSelected([]); setIndex(0); if (!remaining.length) { setStage('camera'); setReady(false); } } }]);
  const exportPages = pages.filter((p) => selected.includes(p.id));
  const exportAs = async (format: 'pdf' | 'word' | 'long' | 'album') => {
    setExportOpen(false);
    await run(format === 'word' ? '正在本机识别中英文并生成 Word…' : '正在导出…', async () => {
      if (!exportPages.length) throw new Error('请至少选择一页。');
      if (format === 'album') { await saveScans(exportPages, (n) => setBusy(`已保存 ${n}/${exportPages.length} 页`)); Alert.alert('保存完成', `${exportPages.length} 页已保存至系统图库的 PinPic 相册。`); }
    else { await exportScans(exportPages, format, title); Alert.alert(Platform.OS === 'android' ? '保存完成' : '导出文件', Platform.OS === 'android' ? '文件已保存到手机“下载/PinPic”文件夹，可在文件管理器中查看。' : '请在系统分享面板中选择保存到文件。'); }
    });
  };
  const toCamera = () => { setRetake(null); setStage('camera'); setReady(false); };
  const changeMode = (value: 'smart' | 'book') => { setMode(value); setLive(null); };
  const pagination = <View style={styles.pagination}><ScanTool label="‹" onPress={() => setIndex(Math.max(0, index - 1))} disabled={index <= 0 || !!busy} /><Text style={styles.white}>{index + 1} / {pages.length}</Text><ScanTool label="›" onPress={() => setIndex(Math.min(pages.length - 1, index + 1))} disabled={index >= pages.length - 1 || !!busy} /></View>;

  return <SafeAreaView style={[styles.safe, stage === 'preview' && styles.light]} edges={['top', 'bottom']}>
    <View style={[styles.header, stage !== 'camera' && styles.compactHeader]}>
      <Pressable disabled={!!busy} onPress={confirmExit} style={styles.back} accessibilityLabel="返回"><Text style={[styles.backText, stage === 'preview' && styles.ink]}>‹</Text></Pressable>
      {stage === 'camera' ? <Text style={styles.title}>扫描</Text> : stage === 'crop' ? <Text style={styles.title}>调整裁切边缘</Text> : <TextInput accessibilityLabel="扫描名称" value={title} onChangeText={setTitle} maxLength={40} style={[styles.name, stage === 'preview' && styles.ink]} />}
      {stage === 'camera' ? <Pressable disabled={!!busy} onPress={() => setFlash(!flash)} style={styles.tool}><Text style={styles.accent}>{flash ? '闪光灯 开' : '闪光灯 关'}</Text></Pressable> : stage === 'preview' ? <Pressable onPress={toCamera} disabled={!!busy}><Text style={styles.greenText}>＋ 添加</Text></Pressable> : <Pressable disabled={!!busy} onPress={toCamera}><Text style={styles.accent}>继续拍</Text></Pressable>}
    </View>

    {stage === 'camera' ? <>
      {!scannerAvailable() ? <View style={styles.permission}><Text style={styles.white}>请安装含扫描引擎的新版 Android APK 后使用。</Text></View> : !permission?.granted ? <View style={styles.permission}><Text style={styles.permissionTitle}>用相机扫描纸质文档</Text><Text style={styles.hint}>允许相机访问后即可拍摄；也可以从相册导入。</Text><Pressable style={styles.primary} onPress={() => void (permission?.canAskAgain === false ? Linking.openSettings() : requestPermission())}><Text style={styles.primaryText}>{permission?.canAskAgain === false ? '前往系统设置' : '允许使用相机'}</Text></Pressable></View> : <View style={styles.camera}>
        {focused && foreground ? <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" autofocus="on" flash={flash ? 'on' : 'off'} animateShutter={false} onCameraReady={() => setReady(true)} onMountError={({ message }) => { setReady(false); Alert.alert('相机无法启动', message); }} /> : null}
        {live ? <Svg pointerEvents="none" style={StyleSheet.absoluteFill} viewBox={`0 0 ${live.width} ${live.height}`} preserveAspectRatio="xMidYMid slice">{live.regions.filter((r) => r.detected).map((r, i) => <Polygon key={i} points={r.points.map((p) => `${p.x * live.width},${p.y * live.height}`).join(' ')} fill="#1CCBB01A" stroke={ACCENT} strokeWidth={3} />)}</Svg> : null}
        <View pointerEvents="none" style={styles.guideFrame}>{split !== 'none' ? <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 100" preserveAspectRatio="none"><Line x1={split === 'vertical' ? 50 : 0} y1={split === 'horizontal' ? 50 : 0} x2={split === 'vertical' ? 50 : 100} y2={split === 'horizontal' ? 50 : 100} stroke="#FFFFFF" strokeWidth={0.7} strokeDasharray="2,2" /></Svg> : null}</View>
        <View pointerEvents="none" style={styles.cameraHint}><Text style={styles.white}>{retake ? '重拍当前页' : live?.regions.every((r) => r.detected) ? '已找到边缘 · 保持平稳后拍摄' : autoEdge ? '将纸张完整放入画面，寻找边缘…' : '拍摄后可手动调整四角与边线'}</Text></View>
        {split !== 'none' ? <View pointerEvents="none" style={styles.splitLabel}><Text style={styles.white}>{axis === 'horizontal' ? '上半页 A / 下半页 B' : '左页 A / 右页 B'} · 每次增加 2 页</Text></View> : null}
        <View style={styles.cameraSettings}><Pressable disabled={!!busy} style={styles.cameraSetting} onPress={() => { setAutoEdge(!autoEdge); setLive(null); }}><Text style={styles.segmentText}>自动识边 {autoEdge ? '开' : '关'}</Text></Pressable>{split !== 'none' ? <Pressable disabled={!!busy} style={styles.cameraSetting} onPress={() => { setAxis(axis === 'horizontal' ? 'vertical' : 'horizontal'); setLive(null); }}><Text style={styles.segmentText}>{axis === 'horizontal' ? '上下分割 ⇄' : '左右分割 ⇄'}</Text></Pressable> : null}</View>
      </View>}
      <View style={styles.captureOptions}><View style={styles.segment}>{(mode === 'smart' ? ['单页', '多页'] : ['单页', '双页']).map((label, i) => <Pressable key={label} disabled={!!busy || !!retake} onPress={() => mode === 'smart' ? setSmartMulti(i === 1) : setBookDouble(i === 1)} style={[styles.segmentItem, (mode === 'smart' ? smartMulti : bookDouble) === (i === 1) && styles.segmentActive]}><Text style={styles.segmentText}>{label}</Text></Pressable>)}</View></View>
      <View style={styles.mainTabs}>{[{ id: 'smart', label: '智能扫描' }, { id: 'book', label: '扫描书籍' }].map((tab) => <Pressable key={tab.id} disabled={!!busy || !!retake} onPress={() => changeMode(tab.id as 'smart' | 'book')} style={[styles.mainTab, mode === tab.id && styles.mainTabActive]}><Text style={mode === tab.id ? styles.accent : styles.white}>{tab.label}</Text></Pressable>)}</View>
      <View style={styles.captureControls}><Pressable disabled={!!busy || !scannerAvailable()} onPress={() => void importPhotos()} style={styles.sideControl}><ActionGlyph kind="import" size={29} /><Text style={styles.hint}>导入图片</Text></Pressable><Pressable disabled={!!busy || !ready || !permission?.granted || !scannerAvailable()} onPress={() => void captureAction.current()} style={[styles.shutter, (!!busy || !ready) && styles.disabled]} accessibilityLabel="拍摄扫描页"><View style={styles.shutterInner} /></Pressable><View style={styles.doneStack}>{pages.length ? <Pressable style={styles.floatingThumb} disabled={!!busy} onPress={() => openEdit(pages.length - 1)} accessibilityLabel={`查看已拍摄的 ${pages.length} 页`}><Image source={{ uri: pages[pages.length - 1].image.uri }} style={styles.captureThumb} /><Text style={styles.count}>{pages.length}</Text></Pressable> : null}<Pressable disabled={!pages.length || !!busy} onPress={() => { setSelected(pages.map((p) => p.id)); setStage('preview'); }} style={[styles.done, !pages.length && styles.disabled]}><Text style={styles.primaryText}>确定</Text></Pressable></View></View>
    </> : null}

    {stage === 'edit' && current ? <>
      <View style={styles.imageArea}><Image source={{ uri: current.image.uri }} style={styles.pageImage} resizeMode="contain" /></View>
      {pagination}
      <Text style={styles.editorHint}>{current.detected ? '已自动识别并透视裁切，可继续调整' : '未找到可靠边缘，请点击裁剪拖动边线确认范围'}</Text>
      <ScrollView horizontal style={styles.filterScroll} contentContainerStyle={styles.filterRow} showsHorizontalScrollIndicator={false}>{SCAN_FILTERS.map((filter) => <Pressable key={filter.id} disabled={!!busy} onPress={() => void updatePage({ filter: filter.id }, allFilters)} style={[styles.filter, current.filter === filter.id && styles.filterActive]}><Image source={{ uri: current.image.uri }} style={styles.filterThumb} /><Text style={current.filter === filter.id ? styles.accent : styles.white}>{filter.label}</Text></Pressable>)}</ScrollView>
      <Pressable style={styles.allFilter} onPress={() => setAllFilters(!allFilters)}><Text style={styles.hint}>{allFilters ? '☑' : '□'} 效果应用到所有页</Text></Pressable>
      <View style={styles.editTools}>
        <ScanTool label="↶ 左转" onPress={() => void updatePage({ rotation: (current.rotation + 3) % 4 })} disabled={!!busy} />
        <ScanTool label="⌗ 裁剪" onPress={() => { setCrop(current.quad); setStage('crop'); }} disabled={!!busy} />
        <ScanTool label="重拍" onPress={() => { setRetake(current.id); setStage('camera'); setReady(false); }} disabled={!!busy} />
      </View>
      <Pressable disabled={!!busy} onPress={() => setStage('preview')} style={styles.confirm}><Text style={styles.primaryText}>✓ 确认，进入预览</Text></Pressable>
    </> : null}

    {stage === 'crop' && current ? <>
      <Text style={styles.cropHint}>拖动四角或边线调整，放大镜辅助对齐</Text>
      <ScanCropEditor source={current.source} points={crop} onChange={setCrop} />
      <View style={styles.editTools}><ScanTool label="自动识别" disabled={!!busy} onPress={() => void run('重新识别边缘…', async () => { const detection = await detectScan(current.source.uri, current.split); const region = detection.regions[current.regionIndex]; setCrop(region.points); if (!region.detected) Alert.alert('未找到可靠边缘', '请拖动边线手动选择。'); })} /><ScanTool label="全部" onPress={() => setCrop(defaultScanQuads(current.split)[current.regionIndex])} disabled={!!busy} /><ScanTool label="还原" onPress={() => setCrop(current.quad)} disabled={!!busy} /></View>
      <Pressable disabled={!!busy} style={styles.confirm} onPress={() => void run('正在透视裁切…', async () => { const page = { ...current, quad: crop }; const image = await renderScan(page); setPages((list) => list.map((p) => p.id === current.id ? { ...page, image } : p)); setStage('edit'); })}><Text style={styles.primaryText}>✓ 确定裁切</Text></Pressable>
    </> : null}

    {stage === 'preview' ? <>
      <View style={styles.previewBar}><Text style={styles.ink}>共 {pages.length} 页 · 已选 {selected.length} 页</Text><View style={styles.previewActions}><Pressable disabled={!selected.length} onPress={deleteSelected}><Text style={[styles.greenText, !selected.length && styles.mutedAction]}>删除</Text></Pressable><Pressable disabled={!selected.length} onPress={() => setPages((list) => moveSelectedPages(list, selected, -1))}><Text style={[styles.greenText, !selected.length && styles.mutedAction]}>前移</Text></Pressable><Pressable disabled={!selected.length} onPress={() => setPages((list) => moveSelectedPages(list, selected, 1))}><Text style={[styles.greenText, !selected.length && styles.mutedAction]}>后移</Text></Pressable><Pressable onPress={() => setSelected(selected.length === pages.length ? [] : pages.map((p) => p.id))}><Text style={styles.greenText}>{selected.length === pages.length ? '取消全选' : '全选'}</Text></Pressable></View></View>
      <ScanPageGrid pages={pages} selected={selected} disabled={!!busy} onEdit={openEdit} onToggle={(id) => setSelected((ids) => ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id])} onDrop={(id, target) => setPages((list) => dropScanPage(list, id, target))} />
      <View style={styles.previewBottom}><Pressable onPress={toCamera} style={styles.addButton}><Text style={styles.greenText}>＋ 继续拍</Text></Pressable><Pressable disabled={!selected.length || !!busy} onPress={() => setExportOpen(true)} style={[styles.exportButton, !selected.length && styles.disabled]}><Text style={styles.primaryText}>导出 / 保存 ({selected.length})</Text></Pressable></View>
    </> : null}

    <Modal transparent visible={exportOpen} animationType="slide" onRequestClose={() => setExportOpen(false)}><View style={styles.modalShade}><View style={styles.exportSheet}><Text style={styles.sheetTitle}>导出 {exportPages.length} 页</Text>{[{ id: 'pdf', title: '以 PDF 导出', detail: '按页保存扫描图，适合阅读与打印' }, { id: 'word', title: '以 Word 导出', detail: '本机识别中英文，包含可编辑文字及原扫描图' }, { id: 'long', title: '以长图导出', detail: '按当前顺序拼接为一张图片' }, { id: 'album', title: '保存到相册', detail: '每页单独保存至 PinPic 相册' }].map((item) => <Pressable key={item.id} onPress={() => void exportAs(item.id as 'pdf' | 'word' | 'long' | 'album')} style={styles.exportOption}><Text style={styles.optionTitle}>{item.title}</Text><Text style={styles.optionHint}>{item.detail}</Text></Pressable>)}<Text style={styles.optionHint}>文字识别结果请校对；复杂表格、弯曲书页的排版可能需要手动调整。</Text><Pressable onPress={() => setExportOpen(false)} style={styles.cancel}><Text style={styles.greenText}>取消</Text></Pressable></View></View></Modal>
    {!!busy ? <View style={styles.busy}><ActivityIndicator size="large" color={ACCENT} /><Text style={styles.white}>{busy}</Text></View> : null}
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  segmentText: { color: '#FFFFFF', fontSize: 12 }, compactHeader: { height: 44 }, cameraSettings: { position: 'absolute', right: 8, bottom: 8, flexDirection: 'row', gap: 8 }, cameraSetting: { padding: 8, borderRadius: 8, backgroundColor: '#00000099' },
  safe: { flex: 1, backgroundColor: '#101316' }, light: { backgroundColor: '#F5F7F8' }, header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, height: 58 }, back: { width: 32 }, backText: { color: '#FFFFFF', fontSize: 38 }, title: { flex: 1, color: '#FFFFFF', fontSize: 20, fontWeight: '700' }, name: { flex: 1, color: '#FFFFFF', fontSize: 17, borderBottomWidth: 1, borderColor: '#777', paddingVertical: 7 }, white: { color: '#FFFFFF', fontSize: 14 }, accent: { color: ACCENT, fontSize: 14, fontWeight: '600' }, ink: { color: '#22282E' }, greenText: { color: '#087F75', fontWeight: '700', fontSize: 15 }, mutedAction: { opacity: 0.35 }, hint: { color: '#B1B7BF', fontSize: 12, lineHeight: 20, textAlign: 'center' }, camera: { flex: 1, overflow: 'hidden', backgroundColor: '#000' }, guideFrame: { position: 'absolute', top: '5%', bottom: '5%', left: '5%', right: '5%', borderWidth: 1, borderStyle: 'dashed', borderColor: '#FFFFFF99', borderRadius: 5 }, cameraHint: { position: 'absolute', top: 14, alignSelf: 'center', backgroundColor: '#00000088', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 }, splitLabel: { position: 'absolute', top: '50%', alignSelf: 'center', backgroundColor: '#00000088', padding: 6, borderRadius: 5 }, captureOptions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 5 }, segment: { flexDirection: 'row', borderRadius: 20, backgroundColor: '#2B3136', padding: 2 }, segmentItem: { paddingVertical: 5, paddingHorizontal: 15, borderRadius: 18 }, segmentActive: { backgroundColor: '#667079' }, mainTabs: { flexDirection: 'row', justifyContent: 'center', gap: 38, paddingVertical: 4 }, mainTab: { paddingVertical: 8 }, mainTabActive: { borderBottomWidth: 3, borderColor: ACCENT }, captureControls: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 8 }, sideControl: { alignItems: 'center', gap: 5, width: 90 }, importGlyph: { color: '#FFFFFF', fontSize: 27, lineHeight: 30 }, shutter: { width: 78, height: 78, borderRadius: 39, borderWidth: 4, borderColor: ACCENT, alignItems: 'center', justifyContent: 'center' }, shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#FFFFFF' }, doneStack: { width: 110, alignItems: 'center', gap: 5 }, done: { backgroundColor: '#087F75', paddingHorizontal: 24, paddingVertical: 11, borderRadius: 10 }, disabled: { opacity: 0.35 }, primaryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 }, primary: { padding: 16, borderRadius: 10, backgroundColor: '#087F75' }, permission: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, gap: 22 }, permissionTitle: { color: '#FFFFFF', fontSize: 21, fontWeight: '700' }, floatingThumb: { position: 'relative' }, captureThumb: { width: 48, height: 45, borderRadius: 5, backgroundColor: '#FFFFFF' }, count: { position: 'absolute', right: -8, top: -8, color: '#FFFFFF', backgroundColor: '#FF6854', minWidth: 22, textAlign: 'center', borderRadius: 12, padding: 3, overflow: 'hidden' }, thumbLabel: { color: '#FFFFFF', backgroundColor: '#087F75', padding: 4, fontSize: 11, textAlign: 'center' }, imageArea: { flex: 1, marginHorizontal: 12, marginVertical: 4 }, pageImage: { width: '100%', height: '100%' }, pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 }, tool: { minHeight: 44, paddingHorizontal: 10, justifyContent: 'center', alignItems: 'center' }, toolText: { color: '#FFFFFF', fontSize: 15 }, editorHint: { color: '#B1B7BF', fontSize: 11, textAlign: 'center', padding: 3 }, filterScroll: { flexGrow: 0, flexShrink: 0 }, filterRow: { gap: 9, paddingHorizontal: 16, paddingVertical: 5 }, filter: { alignItems: 'center', backgroundColor: '#252B30', borderRadius: 8, padding: 5, gap: 5, borderWidth: 2, borderColor: 'transparent' }, filterActive: { borderColor: ACCENT }, filterThumb: { width: 56, height: 55, resizeMode: 'cover', borderRadius: 3 }, allFilter: { alignSelf: 'flex-end', paddingHorizontal: 18, paddingVertical: 2 }, editTools: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 3, flexGrow: 0 }, confirm: { marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: 10, backgroundColor: '#087F75', alignItems: 'center' }, cropHint: { color: '#B1B7BF', padding: 5, textAlign: 'center', fontSize: 13 }, previewBar: { gap: 5, paddingHorizontal: 12, paddingVertical: 4 }, previewActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 34 }, grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 10, paddingBottom: 8, columnGap: '4%', rowGap: 8 }, gridHint: { width: '100%', color: '#7B838B', fontSize: 11, paddingVertical: 2 }, gridItem: { width: '48%' }, gridPhoto: { width: '100%', aspectRatio: 0.78, backgroundColor: '#FFFFFF', borderRadius: 5, overflow: 'hidden' }, checkbox: { position: 'absolute', top: 7, right: 7, width: 27, height: 27, borderRadius: 5, borderWidth: 2, borderColor: '#8F999F', backgroundColor: '#FFFFFFCC', alignItems: 'center', justifyContent: 'center' }, checked: { borderColor: '#087F75', backgroundColor: '#087F75' }, checkText: { color: '#FFFFFF', fontSize: 19, fontWeight: '700' }, pageNumber: { textAlign: 'center', color: '#333A40', paddingTop: 5, fontSize: 13 }, previewBottom: { padding: 10, flexDirection: 'row', justifyContent: 'space-between', gap: 10, alignItems: 'center', backgroundColor: '#FFFFFF' }, addButton: { padding: 8 }, exportButton: { paddingHorizontal: 18, paddingVertical: 12, alignItems: 'center', backgroundColor: '#087F75', borderRadius: 10 }, modalShade: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000088' }, exportSheet: { backgroundColor: '#FFFFFF', padding: 24, paddingBottom: 36, borderTopLeftRadius: 22, borderTopRightRadius: 22 }, sheetTitle: { fontSize: 21, fontWeight: '700', color: '#20282D', paddingBottom: 12 }, exportOption: { paddingVertical: 16, borderBottomWidth: 1, borderColor: '#EDF0F1', gap: 4 }, optionTitle: { color: '#20282D', fontSize: 17, fontWeight: '600' }, optionHint: { color: '#7C858C', fontSize: 12, lineHeight: 20, paddingTop: 5 }, cancel: { alignItems: 'center', paddingTop: 20 }, busy: { ...StyleSheet.absoluteFill, backgroundColor: '#000000BB', justifyContent: 'center', alignItems: 'center', gap: 20, padding: 30 },
});
