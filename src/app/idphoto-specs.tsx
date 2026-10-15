import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ID_PHOTO_SPECS } from '../lib/idPhoto';
import { chrome, IDPhotoHeader, idColors } from '../components/IDPhotoChrome';
import { IDPhotoGuideCarousel } from '../components/IDPhotoGuideCarousel';

const categories = ['常用尺寸', '近期热门', '考试证照', '护照签证', '个人证件'];
export default function IDPhotoSpecsScreen() {
  const router = useRouter();
  const [category, setCategory] = useState(categories[0]);
  const [query, setQuery] = useState('');
  const list = ID_PHOTO_SPECS.filter((spec) => (query ? spec.name.includes(query.trim()) : category === '近期热门' || spec.category === category));
  return <SafeAreaView style={chrome.safe} edges={['top', 'bottom']}>
    <IDPhotoHeader title="其他尺寸" />
    <View style={{ marginHorizontal: 16, marginTop: 16 }}><IDPhotoGuideCarousel /></View>
    <View style={styles.search}><TextInput placeholder="输入证件照名称" value={query} onChangeText={setQuery} style={styles.input} returnKeyType="search" /><Text style={styles.searchText}>搜索</Text></View>
    <View style={styles.tabs}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>{categories.map((name) => <Pressable key={name} onPress={() => { setCategory(name); setQuery(''); }}><Text style={[styles.tab, name === category && styles.active]}>{name}</Text></Pressable>)}</ScrollView></View>
    <ScrollView contentContainerStyle={styles.list}>{list.map((spec) => <Pressable key={spec.id} style={styles.card} onPress={() => router.push({ pathname: '/idphoto-spec', params: { id: spec.id } })}><View style={{ gap: 14 }}><Text style={styles.name}>{spec.name}</Text><Text style={styles.dimensions}>像素  {spec.width}×{spec.height}px    冲印  {spec.mmWidth}×{spec.mmHeight}mm</Text></View><Text style={styles.camera}>▣</Text></Pressable>)}{list.length === 0 ? <Text style={styles.empty}>暂无匹配规格，请尝试其他名称或自定义尺寸。</Text> : null}</ScrollView>
    <Pressable style={styles.custom} onPress={() => router.push({ pathname: '/idphoto-spec', params: { id: 'custom' } })}><Text style={{ color: idColors.blue, fontSize: 16 }}>＋ 自定义尺寸</Text></Pressable>
  </SafeAreaView>;
}
const styles = StyleSheet.create({ search: { flexDirection: 'row', margin: 16, borderWidth: 1, borderColor: idColors.blue, borderRadius: 30, backgroundColor: '#FFFFFF', alignItems: 'center', paddingLeft: 18, paddingRight: 3 }, input: { flex: 1, minHeight: 45, fontSize: 15 }, searchText: { backgroundColor: idColors.blue, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 25, color: '#FFFFFF' }, tabs: { backgroundColor: '#FFFFFF' }, tabRow: { gap: 20, paddingHorizontal: 20, paddingTop: 8 }, tab: { color: '#999999', fontSize: 17, paddingVertical: 15 }, active: { color: idColors.ink, borderBottomWidth: 3, borderColor: idColors.blue, fontWeight: '700' }, list: { padding: 16, gap: 13 }, card: { ...chrome.card, minHeight: 94, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, name: { fontSize: 19, fontWeight: '700' }, dimensions: { fontSize: 11, color: '#999999' }, camera: { fontSize: 26, color: idColors.blue, backgroundColor: '#F0F0FE', padding: 8, borderRadius: 25 }, custom: { padding: 18, alignItems: 'center', backgroundColor: '#FFFFFF' }, empty: { textAlign: 'center', color: '#777777', padding: 20 } });
