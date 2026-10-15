import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useStudio } from '../store/StudioContext';
import type { FeatureMode } from '../types';
import { colors, shadows } from '../theme';
import { ActionGlyph } from '../components/ActionGlyph';

const homeModes = [
  { id: 'layout', label: '布局', active: true },
  { id: 'long', label: '长图拼接', active: true },
  { id: 'free', label: '自由拼图', active: true },
  { id: 'nine', label: '九宫格', active: true },
  { id: 'grid', label: '格子拼图', active: false },
] as const;

const templateCategories = ['热门', '最新', '拼贴', '动图', '国庆节 🇨🇳', '旅行'];
const idEntrances = [
  { id: 'one', title: '一寸照', detail: '25mm×35mm', glyph: '▣' },
  { id: 'two', title: '二寸照', detail: '35mm×49mm', glyph: '▣' },
  { id: 'more', title: '更多规格', detail: '点击查看更多尺寸', glyph: '☷' },
  { id: 'background', title: '证件照换底色', detail: '蓝底 · 白底 · 红底', glyph: '▧' },
  { id: 'kb', title: '修改文件kb大小', detail: '压缩图片文件', glyph: '▤' },
  { id: 'px', title: '修改文件px尺寸', detail: '调整像素尺寸', glyph: '▱' },
];

function PreviewMosaic({ variant }: { variant: number }) {
  const palettes = [
    ['#F2C3AE', '#D9E2D1', '#E2C5D9', '#F1DA9D'],
    ['#C4D8EA', '#F0B7A7', '#E8D9C2', '#C4C0E8'],
    ['#E8B9D2', '#BBD6CC', '#F3D2A7', '#B7CBE1'],
  ];
  return (
    <View style={styles.mosaic}>
      <View style={[styles.mosaicCell, { backgroundColor: palettes[variant % 3][0], flex: 1.15 }]} />
      <View style={styles.mosaicColumn}>
        <View style={[styles.mosaicCell, { backgroundColor: palettes[variant % 3][1] }]} />
        <View style={[styles.mosaicCell, { backgroundColor: palettes[variant % 3][2] }]} />
      </View>
      <View style={[styles.mosaicCell, { backgroundColor: palettes[variant % 3][3], flex: 0.82 }]} />
    </View>
  );
}

function HomeFeatureGlyph({ kind, disabled }: { kind: string; disabled: boolean }) {
  const color = disabled ? colors.muted : colors.ink;
  if (kind === 'layout') {
    return (
      <View style={[styles.glyphLayout, { borderColor: color }]}>
        <View style={[styles.glyphLayoutVertical, { backgroundColor: color }]} />
        <View style={[styles.glyphLayoutHorizontal, { backgroundColor: color }]} />
      </View>
    );
  }
  if (kind === 'long') {
    return (
      <View style={[styles.glyphLong, { borderColor: color }]}>
        {[0, 1, 2].map((line) => <View key={line} style={[styles.glyphLongLine, { backgroundColor: color }]} />)}
      </View>
    );
  }
  if (kind === 'free') {
    return (
      <View style={styles.glyphFreeWrap}>
        <View style={[styles.glyphFreeFrame, { borderColor: color }]} />
        <Text style={[styles.glyphFreeSpark, { color }]}>✦</Text>
      </View>
    );
  }
  const cellCount = kind === 'grid' ? 4 : 3;
  const cellSize = kind === 'grid' ? 6 : 8;
  return (
    <View style={styles.glyphGrid}>
      {Array.from({ length: cellCount }, (_, row) => (
        <View key={row} style={styles.glyphGridRow}>
          {Array.from({ length: cellCount }, (_, column) => (
            <View key={column} style={{ width: cellSize, height: cellSize, borderWidth: 1.6, borderColor: color, borderRadius: 1 }} />
          ))}
        </View>
      ))}
    </View>
  );
}

function StoreGlyph() {
  return (
    <View style={styles.storeGlyph}>
      <View style={styles.storeRoof} />
      <View style={styles.storeAwning} />
      <View style={styles.storeBody}>
        <View style={styles.storeDoor} />
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { setPhotos, setMode, setRatio, setLayoutId } = useStudio();
  const [busyMode, setBusyMode] = useState<FeatureMode | null>(null);
  const [category, setCategory] = useState('热门');
  const startID = (id: string) => {
    if (id === 'more') router.push('/idphoto-specs');
    else if (id === 'background') { setMode('idphoto-background'); setPhotos([]); router.push('/album'); }
    else if (id === 'kb' || id === 'px') router.push({ pathname: '/idphoto-utility', params: { mode: id } });
    else router.push({ pathname: '/idphoto-spec', params: { id } });
  };

  const start = async (mode: FeatureMode) => {
    if (busyMode) return;
    setBusyMode(mode);
    try {
      setPhotos([]);
      setMode(mode);
      setRatio(1);
      setLayoutId(mode === 'quick' ? 'split-v' : 'grid');

      router.push('/album');
    } catch (error) {
      Alert.alert('无法打开相册', error instanceof Error ? error.message : '请稍后重试。');
    } finally {
      setBusyMode(null);
    }
  };

  const showFreeVersion = () => {
    Alert.alert('PinPic V1 免费版', '当前版本的拼图和编辑功能均可免费使用，不需要购买或订阅。');
  };

  const onModeTap = (id: string) => {
    if (id === 'layout' || id === 'free' || id === 'long' || id === 'nine') {
      void start(id as FeatureMode);
    } else {
      Alert.alert('即将推出', `${homeModes.find((item) => item.id === id)?.label ?? '此功能'}不在 V1 功能范围内。`);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerTools}>
            <Pressable onPress={() => router.push('/settings')} style={styles.headerIcon} accessibilityLabel="设置">
              <Text style={styles.headerIconText}>⚙</Text>
            </Pressable>
            <Pressable onPress={showFreeVersion} style={styles.headerIcon} accessibilityLabel="购买，当前版本免费">
              <StoreGlyph />
            </Pressable>
          </View>
          <Pressable onPress={showFreeVersion} style={styles.freeBadge} accessibilityLabel="免费版本说明">
            <Text style={styles.freeBadgeText}>◆</Text>
          </Pressable>
        </View>

        <View style={styles.heroActions}>
          <Pressable disabled={!!busyMode} style={styles.heroButton} onPress={() => void start('quick')} accessibilityRole="button">
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>{busyMode === 'quick' ? '正在打开…' : '快速拼图'}</Text>
            </View>
            {busyMode === 'quick' ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.heroIcon}>▧</Text>}
          </Pressable>
          <Pressable disabled={!!busyMode} style={[styles.heroButton, styles.heroEdit]} onPress={() => void start('single')} accessibilityRole="button">
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>{busyMode === 'single' ? '正在打开…' : '编辑'}</Text>
            </View>
            {busyMode === 'single' ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.heroIcon}>✧</Text>}
          </Pressable>
          <Pressable style={[styles.heroButton, styles.heroScan]} onPress={() => router.push('/scan')} accessibilityRole="button" accessibilityLabel="扫描，新功能">
            <Text style={styles.newBadge}>NEW</Text>
            <Text style={styles.heroTitle}>扫描</Text><ActionGlyph kind="camera" />
          </Pressable>
        </View>

        <View style={styles.modeRow}>
          {homeModes.map((item) => (
            <Pressable key={item.id} disabled={!!busyMode} style={styles.modeItem} onPress={() => onModeTap(item.id)}>
              <View style={styles.modeIconWrap}>
                <HomeFeatureGlyph kind={item.id} disabled={!item.active} />
              </View>
              <Text style={[styles.modeLabel, !item.active && styles.modeLabelDisabled]}>{item.label}</Text>
              {!item.active ? <Text style={styles.comingSoon}>后续</Text> : null}
            </Pressable>
          ))}
        </View>

        <View style={styles.inspirationPanel}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
            {templateCategories.map((label) => (
              <Pressable key={label} style={styles.category} onPress={() => setCategory(label)}>
                <Text style={[styles.categoryText, label === category && styles.categoryActiveText]}>{label}</Text>
                {label === category ? <View style={styles.categoryMarker} /> : null}
              </Pressable>
            ))}
          </ScrollView>

          {category === '热门' ? <View style={styles.idGrid}>
            <View style={styles.idTop}>
              <Pressable onPress={() => startID('one')} style={[styles.idCard, styles.idOne]}><Text style={styles.idRibbon}>常用尺寸</Text><View style={styles.idPortrait}><Image source={require('../../assets/x001.png')} style={styles.idPortraitImage} resizeMode="contain" accessibilityLabel="一寸证件照示例" /></View><Text style={styles.idTitle}>一寸照</Text><Text style={styles.idDetail}>25mm×35mm</Text></Pressable>
              <View style={styles.idColumn}>{idEntrances.slice(1, 3).map((item) => <Pressable key={item.id} style={[styles.idCard, styles.idSmall]} onPress={() => startID(item.id)}>{item.id === 'two' ? <Text style={styles.idRibbon}>常用尺寸</Text> : <Text style={styles.idMoreIcon}>• ━</Text>}<Text style={styles.idTitle}>{item.title}</Text><Text style={styles.idDetail}>{item.detail}</Text></Pressable>)}</View>
            </View>
            <View style={styles.idBottom}>{idEntrances.slice(3).map((item) => <Pressable key={item.id} style={[styles.idCard, styles.idUtility]} onPress={() => startID(item.id)}><View style={styles.idUtilityIcon}><Text style={styles.idUtilityGlyph}>{item.glyph}</Text></View><Text style={styles.idUtilityTitle}>{item.title}</Text></Pressable>)}</View>
          </View> : <View style={styles.templateGrid}>
            {['生活记录', '周末旅行', '温柔日常', '杂志拼贴'].map((title, index) => (
              <Pressable key={title} style={styles.templateCard} onPress={() => void start('quick')}>
                <PreviewMosaic variant={index} />
                <View style={styles.templateInfo}>
                  <Text style={styles.templateTitle}>{title}</Text>
                  <Text style={styles.templateSub}>{index % 2 === 0 ? '多图拼贴' : '精选布局'}</Text>
                </View>
              </Pressable>
            ))}
          </View>}
        </View>

        <View style={styles.footerNote}>
          <Text style={styles.footerMark}>✦</Text>
          <Text style={styles.footerText}>所有编辑都在本机完成，可保存到相册或导出扫描文档。</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: 18, paddingBottom: 28, gap: 12 },
  header: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 1 },
  headerTools: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  headerIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  headerIconText: { color: colors.ink, fontSize: 25 },
  storeGlyph: { width: 25, height: 26 },
  storeRoof: { position: 'absolute', left: 1, top: 3, width: 23, height: 7, borderTopWidth: 2, borderLeftWidth: 2, borderRightWidth: 2, borderColor: colors.ink, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  storeAwning: { position: 'absolute', top: 9, left: 0, width: 25, height: 4, borderBottomWidth: 2, borderColor: colors.ink },
  storeBody: { position: 'absolute', top: 13, left: 3, width: 19, height: 12, borderWidth: 2, borderTopWidth: 0, borderColor: colors.ink, alignItems: 'center', justifyContent: 'flex-end' },
  storeDoor: { width: 6, height: 8, borderWidth: 1.5, borderBottomWidth: 0, borderColor: colors.ink },
  freeBadge: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  freeBadgeText: { color: '#B44FE0', fontSize: 25, fontWeight: '800' },
  heroActions: { flexDirection: 'row', gap: 10 },
  heroButton: { flex: 1, minHeight: 82, borderRadius: 18, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.violet, ...shadows.card },
  heroEdit: { backgroundColor: '#6A7BF0' },
  heroScan: { backgroundColor: '#087F75', borderWidth: 1, borderColor: '#22CFB2' },
  newBadge: { position: 'absolute', right: 6, top: -7, color: '#FFFFFF', backgroundColor: '#FF654F', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, fontWeight: '900', fontSize: 9, overflow: 'hidden' },
  heroCopy: { flexShrink: 1 },
  heroTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  heroIcon: { color: '#FFFFFF', fontSize: 28, fontWeight: '500' },
  modeRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 2, paddingTop: 1, paddingBottom: 2 },
  modeItem: { alignItems: 'center', flex: 1, gap: 1, minWidth: 0 },
  modeIconWrap: { width: 42, height: 38, justifyContent: 'center', alignItems: 'center' },
  glyphLayout: { width: 29, height: 29, borderWidth: 2, borderRadius: 4 },
  glyphLayoutVertical: { position: 'absolute', top: -1, bottom: -1, left: 10, width: 2 },
  glyphLayoutHorizontal: { position: 'absolute', left: 10, right: -1, top: 13, height: 2 },
  glyphLong: { width: 25, height: 31, borderWidth: 2, borderRadius: 5, paddingHorizontal: 3, justifyContent: 'space-evenly' },
  glyphLongLine: { height: 2, borderRadius: 1 },
  glyphFreeWrap: { width: 31, height: 31, alignItems: 'center', justifyContent: 'center' },
  glyphFreeFrame: { width: 23, height: 27, borderWidth: 2, borderRadius: 4, transform: [{ rotate: '-8deg' }] },
  glyphFreeSpark: { position: 'absolute', right: 0, bottom: -1, fontSize: 15, backgroundColor: '#FFFFFF' },
  glyphGrid: { gap: 1.5 },
  glyphGridRow: { flexDirection: 'row', gap: 1.5 },
  modeLabel: { color: colors.ink, fontSize: 10, textAlign: 'center', fontWeight: '600' },
  modeLabelDisabled: { color: colors.muted },
  comingSoon: { color: colors.muted, fontSize: 8, lineHeight: 10 },
  inspirationPanel: { marginHorizontal: -18, paddingTop: 12, paddingHorizontal: 14, paddingBottom: 16, borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: '#FFFFFF', gap: 10 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 21, paddingHorizontal: 8, minHeight: 40 },
  category: { minHeight: 38, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  categoryText: { color: '#787482', fontSize: 14, fontWeight: '500' },
  categoryActiveText: { color: colors.ink, fontWeight: '700' },
  categoryMarker: { position: 'absolute', bottom: 0, width: 30, height: 3, borderRadius: 2, backgroundColor: colors.violet },
  templateGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 11 },
  idGrid: { gap: 13, paddingTop: 4 },
  idTop: { flexDirection: 'row', gap: 13 },
  idCard: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#F0F0F4', shadowColor: '#222222', shadowOpacity: 0.07, shadowRadius: 5, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  idOne: { flex: 1, padding: 15, gap: 10, minHeight: 230, justifyContent: 'flex-end' },
  idRibbon: { position: 'absolute', left: -3, top: 9, backgroundColor: '#FF9719', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 3, color: '#FFFFFF', fontSize: 11 },
  idPortrait: { height: 125, backgroundColor: '#FFFFFF', marginTop: 20, alignItems: 'center', justifyContent: 'center' },
  idPortraitImage: { width: '100%', height: '100%' },
  idTitle: { fontSize: 20, fontWeight: '700', color: '#171717' },
  idDetail: { fontSize: 12, color: '#777777' },
  idColumn: { flex: 1, gap: 13 },
  idSmall: { flex: 1, padding: 18, justifyContent: 'center', gap: 12, paddingTop: 30 },
  idMoreIcon: { color: '#AEC9FF', fontSize: 15, lineHeight: 12 },
  idBottom: { flexDirection: 'row', gap: 10 },
  idUtility: { flex: 1, minHeight: 115, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', gap: 12 },
  idUtilityIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#DEE6FF', justifyContent: 'center', alignItems: 'center' },
  idUtilityGlyph: { fontSize: 30, color: '#5669F0' },
  idUtilityTitle: { fontSize: 10, color: '#363636' },
  templateCard: { width: '48.5%', borderRadius: 18, backgroundColor: '#FFFFFF', overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: '#F0EDF5', ...shadows.card },
  mosaic: { flexDirection: 'row', height: 138, gap: 4, padding: 5 },
  mosaicCell: { borderRadius: 11 },
  mosaicColumn: { flex: 0.82, gap: 4 },
  templateInfo: { paddingHorizontal: 11, paddingBottom: 11, gap: 2 },
  templateTitle: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  templateSub: { color: colors.muted, fontSize: 10 },
  footerNote: { paddingHorizontal: 10, paddingVertical: 4, flexDirection: 'row', gap: 7, alignItems: 'center' },
  footerMark: { color: colors.violet, fontSize: 15 },
  footerText: { color: colors.muted, fontSize: 11, lineHeight: 16, flex: 1 },
});
