import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors } from '../theme';

const SETTINGS = [
  { title: '免费使用', detail: 'V1 的拼图与照片编辑功能全部免费，无需购买或订阅。' },
  { title: '离线处理', detail: '照片选择、编辑和保存均在本机完成；PinPic 不会上传你的照片。' },
  { title: '照片权限', detail: '仅在你主动选择照片或保存作品时，向系统申请所需的相册权限。' },
];

export default function SettingsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityLabel="返回">
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={styles.title}>设置</Text>
        <View style={styles.backButton} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.brandCard}>
          <View style={styles.brandIcon}><Text style={styles.brandGlyph}>✦</Text></View>
          <Text style={styles.brand}>PinPic</Text>
          <Text style={styles.version}>版本 1.2.0 · V1 免费版</Text>
        </View>
        <Pressable style={styles.myPuzzles} onPress={() => router.push('/my-puzzles')} accessibilityRole="button">
          <View style={styles.myPuzzlesIcon}><Text style={styles.myPuzzlesGlyph}>▦</Text></View>
          <View style={styles.myPuzzlesCopy}>
            <Text style={styles.settingTitle}>我的拼图</Text>
            <Text style={styles.settingDetail}>查看保存在手机相册里的作品</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
        <View style={styles.section}>
          {SETTINGS.map((item, index) => (
            <View key={item.title} style={[styles.settingItem, index !== SETTINGS.length - 1 && styles.settingDivider]}>
              <Text style={styles.settingTitle}>{item.title}</Text>
              <Text style={styles.settingDetail}>{item.detail}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.footer}>作品保存到系统相册后，可在设备的照片应用中查看。</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  header: { minHeight: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 46, height: 46, justifyContent: 'center' },
  back: { color: colors.ink, fontSize: 38, lineHeight: 42, marginTop: -5 },
  title: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  content: { padding: 18, gap: 17 },
  brandCard: { alignItems: 'center', paddingVertical: 25, borderRadius: 24, backgroundColor: '#FFFFFF' },
  brandIcon: { width: 58, height: 58, borderRadius: 20, backgroundColor: '#EFECFF', alignItems: 'center', justifyContent: 'center' },
  brandGlyph: { color: colors.violet, fontSize: 30 },
  brand: { color: colors.ink, fontSize: 22, fontWeight: '900', marginTop: 10 },
  version: { color: colors.muted, fontSize: 12, marginTop: 4 },
  myPuzzles: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, backgroundColor: '#FFFFFF' },
  myPuzzlesIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#EFECFF', alignItems: 'center', justifyContent: 'center' },
  myPuzzlesGlyph: { color: colors.violetDark, fontSize: 23 },
  myPuzzlesCopy: { flex: 1, gap: 3 },
  chevron: { color: colors.muted, fontSize: 27, lineHeight: 30 },
  section: { borderRadius: 20, paddingHorizontal: 16, backgroundColor: '#FFFFFF' },
  settingItem: { paddingVertical: 16, gap: 5 },
  settingDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  settingTitle: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  settingDetail: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  footer: { color: colors.muted, fontSize: 11, textAlign: 'center', lineHeight: 17, paddingHorizontal: 15 },
});
