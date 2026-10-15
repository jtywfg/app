import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { chrome, IDPhotoHeader, idColors } from '../components/IDPhotoChrome';
import { cropIDPhoto, detectIDPhoto, getIDPhotoSpec, normalizeIDPhoto, type IDPhotoSpec } from '../lib/idPhoto';
import { useStudio } from '../store/StudioContext';

export default function IDPhotoDetectScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ spec?: string; backgroundOnly?: string }>();
  const { photos, setPhotos } = useStudio();
  const [original] = useState(() => photos[0]);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('检测清晰正脸与人像位置');
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const animation = Animated.loop(Animated.sequence([Animated.timing(progress, { toValue: 1, duration: 1400, useNativeDriver: true }), Animated.timing(progress, { toValue: 0, duration: 1400, useNativeDriver: true })]));
    animation.start();
    return () => animation.stop();
  }, [progress]);
  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        if (!original) throw new Error('请先选择一张照片。');
        const photo = await normalizeIDPhoto(original);
        const check = await detectIDPhoto(photo);
        if (!active) return;
        if (!check.valid || !check.face) { setError(check.reason || '未能识别到清晰的五官，请端正姿势并寻找合适光源。'); return; }
        setStatus('已检测到单人正脸，正在生成证件照');
        const spec: IDPhotoSpec = params.spec ? JSON.parse(params.spec) : getIDPhotoSpec();
        const cropped = params.backgroundOnly === '1' ? photo : await cropIDPhoto(photo, check.face, spec);
        if (!active) return;
        setPhotos([cropped]);
        router.replace({ pathname: '/idphoto-editor', params });
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : '检测失败，请重新选择照片。'); }
    };
    void run();
    return () => { active = false; };
  }, [original, params.spec, params.backgroundOnly, router, setPhotos]); // eslint-disable-line react-hooks/exhaustive-deps
  return <SafeAreaView style={chrome.safe} edges={['top', 'bottom']}>
    <IDPhotoHeader title="正在检测" />
    <View style={styles.content}><View style={styles.scanner}><Image source={{ uri: original?.uri }} style={styles.photo} resizeMode="contain" /><Animated.View style={[styles.line, { transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, 275] }) }] }]} /><Text style={styles.cornerTL}>⌜</Text><Text style={styles.cornerBR}>⌟</Text></View><Text style={styles.title}>证件照生成中，请稍候</Text><Text style={styles.status}>{status}</Text><View style={styles.checks}><Text style={styles.check}>◉  检测人脸数量、取景范围和人像位置</Text><Text style={styles.check}>◉  检查照片分辨率并纠正方向</Text><View style={styles.processing}><ActivityIndicator color={idColors.blue} /><Text style={styles.check}>生成符合所选尺寸的照片</Text></View></View></View>
    <Modal visible={!!error} transparent animationType="fade" onRequestClose={() => router.back()}><View style={styles.shade}><View style={styles.dialog}><Text style={styles.dialogTitle}>提示</Text><Text style={styles.error}>{error}</Text><Pressable onPress={() => router.back()} style={styles.ok}><Text style={styles.okText}>重新选择</Text></Pressable></View></View></Modal>
  </SafeAreaView>;
}
const styles = StyleSheet.create({ content: { flex: 1, padding: 25, justifyContent: 'center', gap: 22 }, scanner: { height: 330, backgroundColor: '#F0F1FC', position: 'relative', padding: 20 }, photo: { flex: 1 }, line: { position: 'absolute', top: 20, left: 15, right: 15, height: 2, backgroundColor: idColors.blue }, cornerTL: { position: 'absolute', left: 0, top: -17, color: idColors.blue, fontSize: 45 }, cornerBR: { position: 'absolute', right: 0, bottom: -13, color: idColors.blue, fontSize: 45 }, title: { fontSize: 21, fontWeight: '700', textAlign: 'center' }, status: { textAlign: 'center', fontSize: 13, color: '#777777' }, checks: { gap: 18 }, check: { fontSize: 14, color: '#747474' }, processing: { flexDirection: 'row', alignItems: 'center', gap: 10 }, shade: { flex: 1, backgroundColor: '#00000088', justifyContent: 'center', padding: 35 }, dialog: { borderRadius: 13, backgroundColor: '#FFFFFF', paddingTop: 25 }, dialogTitle: { textAlign: 'center', fontSize: 23 }, error: { textAlign: 'center', fontSize: 16, padding: 25, lineHeight: 26 }, ok: { borderTopWidth: 1, borderColor: '#EEEEEE', padding: 18 }, okText: { textAlign: 'center', fontSize: 19, color: idColors.blue } });
