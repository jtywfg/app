import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Chip, ScreenHeading } from '../components/Primitives';
import { getLayoutOptions, getLayoutSlots, RATIO_OPTIONS } from '../lib/layouts';
import { useStudio } from '../store/StudioContext';
import { colors } from '../theme';

function TemplatePreview({ layoutId, ratio, width = 156 }: { layoutId: string; ratio: number; width?: number }) {
  const { photos } = useStudio();
  const height = width / ratio;
  const slots = getLayoutSlots(layoutId, photos.length);
  return (
    <View style={[styles.preview, { width, height, backgroundColor: '#FFFFFF' }]}>
      {slots.map((slot, index) => (
        <Image
          key={`${layoutId}-${index}`}
          source={{ uri: photos[index % photos.length]?.uri }}
          resizeMode="cover"
          style={{
            position: 'absolute',
            left: `${slot.x * 100}%`,
            top: `${slot.y * 100}%`,
            width: `${slot.width * 100}%`,
            height: `${slot.height * 100}%`,
            borderColor: '#FFFFFF',
            borderWidth: 2,
          }}
        />
      ))}
    </View>
  );
}

export default function TemplatesScreen() {
  const router = useRouter();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { photos, mode, ratio, setRatio, layoutId, setLayoutId } = useStudio();
  const layouts = getLayoutOptions(photos.length);
  const isLayoutFlow = mode === 'layout';
  const [selectedLayout, setSelectedLayout] = useState(layoutId);

  const chooseLayout = (layoutId: string) => {
    setLayoutId(layoutId);
    router.push('/collage-editor');
  };

  if (photos.length < 2) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Pressable onPress={() => router.replace('/')} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable>
        <Text style={styles.empty}>请先从首页选择至少两张照片。</Text>
      </SafeAreaView>
    );
  }

  if (isLayoutFlow) {
    const activeLayout = layouts.find((layout) => layout.id === selectedLayout) ?? layouts[0];
    const previewWidth = Math.min(screenWidth - 36, screenHeight * 0.42 * ratio);
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable>
          <View style={{ flex: 1 }}>
            <ScreenHeading title="布局拼图" subtitle={`${photos.length} 张照片 · 选择喜欢的拼接效果`} />
          </View>
        </View>

        <View style={styles.ratioArea}>
          <Text style={styles.label}>画布比例</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ratioRow}>
            {RATIO_OPTIONS.map((option) => (
              <Chip key={option.label} label={option.label} selected={ratio === option.value} onPress={() => setRatio(option.value)} />
            ))}
          </ScrollView>
        </View>

        <View style={styles.layoutPreviewArea}>
          <TemplatePreview layoutId={activeLayout?.id ?? layouts[0].id} ratio={ratio} width={previewWidth} />
          <Text style={styles.previewSubtitle}>左右滑动下方预览，点击切换布局</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.layoutChoices}>
          {layouts.map((layout) => {
            const selected = layout.id === (activeLayout?.id ?? layouts[0].id);
            const miniWidth = Math.min(100, 86 * ratio);
            return (
              <Pressable key={layout.id} onPress={() => setSelectedLayout(layout.id)} style={[styles.layoutCard, selected && styles.layoutCardSelected]}>
                <TemplatePreview layoutId={layout.id} ratio={ratio} width={miniWidth} />
                <Text style={[styles.layoutName, selected && styles.layoutNameSelected]}>{layout.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Pressable style={styles.continueButton} onPress={() => chooseLayout(activeLayout?.id ?? layouts[0].id)}>
          <Text style={styles.continueButtonText}>使用此布局</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable>
        <View style={{ flex: 1 }}>
          <ScreenHeading
            title={isLayoutFlow ? '选择布局' : '快速拼图'}
            subtitle={`${photos.length} 张照片 · 自动预览不同排版效果`}
          />
        </View>
      </View>

      <View style={styles.tabs}>
        <Text style={[styles.tab, styles.tabActive]}>相框模板</Text>
        <Text style={styles.tab}>主题模板</Text>
      </View>

      <View style={styles.ratioArea}>
        <Text style={styles.label}>画布比例</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ratioRow}>
          {RATIO_OPTIONS.map((option) => (
            <Chip
              key={option.label}
              label={option.label}
              selected={ratio === option.value}
              onPress={() => setRatio(option.value)}
            />
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        {layouts.map((layout, index) => (
          <Pressable key={layout.id} style={styles.card} onPress={() => chooseLayout(layout.id)}>
            <TemplatePreview layoutId={layout.id} ratio={ratio} />
            <View style={styles.cardInfo}>
              <View>
                <Text style={styles.cardTitle}>{layout.name}</Text>
                <Text style={styles.cardDescription}>{layout.description}</Text>
              </View>
              {index === 2 ? <Text style={styles.proTag}>推荐</Text> : null}
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  header: { flexDirection: 'row', paddingHorizontal: 17, paddingTop: 7, alignItems: 'center', gap: 10 },
  back: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backText: { fontSize: 34, color: colors.ink, lineHeight: 36, marginTop: -4 },
  empty: { color: colors.ink, padding: 22, fontSize: 16 },
  tabs: { marginTop: 18, paddingHorizontal: 22, flexDirection: 'row', gap: 24, borderBottomWidth: 1, borderBottomColor: colors.line },
  tab: { color: colors.muted, paddingBottom: 12, fontSize: 15, fontWeight: '700' },
  tabActive: { color: colors.violet, borderBottomColor: colors.violet, borderBottomWidth: 2 },
  ratioArea: { paddingTop: 16, gap: 9 },
  label: { color: colors.muted, fontSize: 12, fontWeight: '700', paddingHorizontal: 20 },
  ratioRow: { paddingHorizontal: 18, gap: 8, paddingBottom: 5 },
  grid: { padding: 18, paddingTop: 10, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, paddingBottom: 30 },
  card: { width: '48%', padding: 8, borderRadius: 19, backgroundColor: '#FFFFFF', marginBottom: 4, alignItems: 'center' },
  preview: { overflow: 'hidden', borderRadius: 12 },
  cardInfo: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 3, paddingVertical: 9 },
  cardTitle: { color: colors.ink, fontWeight: '700', fontSize: 12 },
  cardDescription: { color: colors.muted, fontSize: 10, marginTop: 2 },
  proTag: { color: colors.violetDark, backgroundColor: '#F0EDFF', fontSize: 10, paddingVertical: 4, paddingHorizontal: 7, borderRadius: 8 },
  layoutPreviewArea: { flex: 1, minHeight: 205, alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 12 },
  previewSubtitle: { color: colors.muted, fontSize: 11 },
  layoutChoices: { gap: 10, paddingHorizontal: 17, paddingVertical: 5, alignItems: 'stretch' },
  layoutCard: { width: 122, height: 96, padding: 7, borderRadius: 15, borderWidth: 1, borderColor: 'transparent', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'space-between', gap: 3 },
  layoutCardSelected: { borderColor: colors.violet, backgroundColor: '#F5F2FF' },
  layoutName: { color: colors.muted, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  layoutNameSelected: { color: colors.violetDark },
  continueButton: { minHeight: 51, marginHorizontal: 17, marginVertical: 8, borderRadius: 16, backgroundColor: colors.violet, alignItems: 'center', justifyContent: 'center' },
  continueButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
