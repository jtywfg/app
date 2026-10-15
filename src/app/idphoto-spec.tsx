import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getIDPhotoSpec, ID_BACKGROUNDS, type IDPhotoSpec } from '../lib/idPhoto';
import { chrome, IDPhotoButton, IDPhotoHeader, idColors } from '../components/IDPhotoChrome';
import { useStudio } from '../store/StudioContext';
import { IDPhotoGuideCarousel } from '../components/IDPhotoGuideCarousel';

export default function IDPhotoSpecScreen() {
  const { id, customSpec } = useLocalSearchParams<{ id?: string; customSpec?: string }>();
  const router = useRouter();
  const { setMode, setPhotos } = useStudio();
  const [customWidth, setCustomWidth] = React.useState('295');
  const [customHeight, setCustomHeight] = React.useState('413');
  const standard: IDPhotoSpec = customSpec ? JSON.parse(customSpec) : getIDPhotoSpec(id);
  const start = (camera: boolean) => {
    let spec = standard;
    if (id === 'custom') {
      const width = Number(customWidth);
      const height = Number(customHeight);
      if (![width, height].every((value) => Number.isInteger(value) && value >= 100 && value <= 3000)) { Alert.alert('尺寸无效', '请输入 100–3000 之间的整数像素尺寸。'); return; }
      spec = { id: 'custom', name: '自定义证件照', width, height, mmWidth: Math.round(width / 300 * 25.4), mmHeight: Math.round(height / 300 * 25.4), category: '自定义' };
    }
    setMode('idphoto'); setPhotos([]);
    router.push({ pathname: camera ? '/idphoto-camera' : '/album', params: { spec: JSON.stringify(spec) } });
  };
  return <SafeAreaView style={chrome.safe} edges={['top', 'bottom']}>
    <IDPhotoHeader title={id === 'custom' ? '自定义尺寸' : standard.name} />
    <ScrollView contentContainerStyle={styles.content}>
      <IDPhotoGuideCarousel />
      <View style={chrome.card}>
        <Text style={styles.cardTitle}>照片规格说明</Text>
        {id === 'custom' ? <View style={styles.inputs}><TextInput keyboardType="number-pad" value={customWidth} onChangeText={setCustomWidth} style={styles.input} placeholder="宽度 px" /><Text>×</Text><TextInput keyboardType="number-pad" value={customHeight} onChangeText={setCustomHeight} style={styles.input} placeholder="高度 px" /></View> : <><Text style={styles.detail}>冲印尺寸：{standard.mmWidth}×{standard.mmHeight}mm</Text><Text style={styles.detail}>像素尺寸：{standard.width}×{standard.height}px</Text></>}
        <Text style={styles.detail}>打印分辨率：300DPI</Text>
        <View style={styles.colorRow}><Text style={styles.detail}>背景颜色：</Text>{ID_BACKGROUNDS[0].map((color) => <View key={color} style={[styles.color, { backgroundColor: color }]} />)}</View>
      </View>
      <View style={chrome.card}><Text style={[styles.cardTitle, { fontWeight: '700' }]}>拍照建议</Text>{['不穿高领服饰，不披发，露出耳朵脖子；', '正面拍摄，抬头挺胸，照片仅包含一人；', '两眼平视前方，不耸肩，保持自然表情；', '着深色衣服，在白色背景墙前成像效果最佳。'].map((tip, index) => <Text key={tip} style={styles.tip}>{index + 1}、{tip}</Text>)}</View>
      <Pressable onPress={() => router.push('/idphoto-specs')}><Text style={styles.other}>查看其他规格 ›</Text></Pressable>
    </ScrollView>
    <View style={chrome.bottom}><IDPhotoButton title="从相册选择" outline onPress={() => start(false)} /><IDPhotoButton title="去拍照" onPress={() => start(true)} /></View>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  content: { padding: 16, gap: 18 }, cardTitle: { fontSize: 20, color: idColors.ink }, detail: { fontSize: 16, color: '#222222' }, colorRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }, color: { height: 24, width: 24, borderRadius: 12, borderWidth: 1, borderColor: '#E7E7E7' }, tip: { fontSize: 15, color: '#757575', lineHeight: 25 }, other: { color: idColors.blue, textAlign: 'center', padding: 8 }, inputs: { flexDirection: 'row', gap: 10, alignItems: 'center' }, input: { borderWidth: 1, borderColor: '#DEDFF0', padding: 10, borderRadius: 8, flex: 1 },
});
