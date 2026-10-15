import React, { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import Svg, { Path, Line } from 'react-native-svg';
import { chrome, IDPhotoButton, IDPhotoHeader, idColors } from '../components/IDPhotoChrome';
import { getIDPhotoSpec, type IDPhotoSpec } from '../lib/idPhoto';
import { useStudio } from '../store/StudioContext';
import type { PhotoAsset } from '../types';

export default function IDPhotoCameraScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ spec?: string; backgroundOnly?: string }>();
  const spec: IDPhotoSpec = params.spec ? JSON.parse(params.spec) : getIDPhotoSpec();
  const { setPhotos } = useStudio();
  const [focused, setFocused] = useState(false);
  useFocusEffect(React.useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [facing, setFacing] = useState<CameraType>('front');
  const [flash, setFlash] = useState(false);
  const [ready, setReady] = useState(false);
  const [taking, setTaking] = useState(false);
  const [photo, setPhoto] = useState<PhotoAsset | null>(null);
  const capture = async () => {
    if (!ready || taking || !camera.current) return;
    setTaking(true);
    try { const result = await camera.current.takePictureAsync({ quality: 1 }); setPhoto(result); }
    catch (error) { Alert.alert('拍摄失败', error instanceof Error ? error.message : '请重试。'); }
    finally { setTaking(false); }
  };
  const usePhoto = () => {
    if (!photo) return;
    setPhotos([photo]);
    router.replace({ pathname: '/idphoto-detect', params });
  };
  if (!permission?.granted) return <SafeAreaView style={chrome.safe}><IDPhotoHeader title="拍摄证件照" /><View style={styles.permission}><Text style={styles.permissionText}>请允许相机访问，以拍摄证件照。</Text><View style={{ height: 52, width: '100%' }}><IDPhotoButton title="允许使用相机" onPress={() => void (permission?.canAskAgain === false ? Linking.openSettings() : requestPermission())} /></View></View></SafeAreaView>;
  return <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
    {photo ? <><IDPhotoHeader title="确认照片" /><Image source={{ uri: photo.uri }} style={{ flex: 1 }} resizeMode="contain" /><View style={styles.confirm}><Pressable onPress={() => { setPhoto(null); setReady(false); }} style={styles.confirmButton}><Text style={styles.confirmIcon}>↶</Text><Text style={styles.confirmText}>重拍</Text></Pressable><Pressable onPress={usePhoto} style={styles.confirmButton}><Text style={[styles.confirmIcon, { color: idColors.blue }]}>✓</Text><Text style={styles.confirmText}>使用照片</Text></Pressable></View></> : <>
      <View style={styles.cameraArea}>
        {focused ? <CameraView ref={camera} style={StyleSheet.absoluteFill} facing={facing} flash={flash ? 'on' : 'off'} onCameraReady={() => setReady(true)} onMountError={({ message }) => Alert.alert('无法打开相机', message)} /> : null}
        <View style={styles.top}><Pressable onPress={() => router.back()}><Text style={styles.whiteIcon}>×</Text></Pressable><Text style={styles.whiteText}>已选规格：{spec.name}</Text><Pressable onPress={() => setFlash(!flash)}><Text style={styles.whiteIcon}>{flash ? 'ϟ' : 'ϟ̸'}</Text></Pressable></View>
        <View pointerEvents="none" style={styles.guide}><Text style={styles.guideText}>请把脸部放入框内</Text></View>
        <Svg pointerEvents="none" style={StyleSheet.absoluteFill} viewBox="0 0 400 620" preserveAspectRatio="xMidYMid meet"><Line x1="90" y1="95" x2="90" y2="520" stroke="#FFFFFF88" /><Line x1="310" y1="95" x2="310" y2="520" stroke="#FFFFFF88" /><Line x1="0" y1="280" x2="400" y2="280" stroke="#FFFFFF88" strokeDasharray="5,5" /><Line x1="0" y1="465" x2="400" y2="465" stroke="#FFFFFF88" strokeDasharray="5,5" /><Path d="M2 530 L125 480 Q150 465 148 435 L148 409 Q104 377 94 320 Q65 310 80 273 Q85 260 94 261 L94 205 Q95 122 200 122 Q305 122 306 205 L306 261 Q315 260 320 273 Q335 310 306 320 Q296 377 252 409 L252 435 Q250 465 275 480 L398 530" fill="none" stroke="#5968FF" strokeWidth="2.5" /></Svg>
      </View>
      <View style={styles.controls}><Pressable onPress={() => Alert.alert('拍照攻略', '请露出额头、耳朵和颈部；面对镜头；使用纯色背景和均匀光线；不要低头或侧脸。')}><Text style={styles.controlText}>▤{ '\n' }攻略</Text></Pressable><Pressable disabled={!ready || taking} accessibilityLabel="拍摄" onPress={() => void capture()} style={[styles.shutter, (!ready || taking) && { opacity: 0.5 }]}>{taking ? <ActivityIndicator color="#FFFFFF" /> : null}</Pressable><Pressable onPress={() => { setReady(false); setFacing(facing === 'front' ? 'back' : 'front'); }}><Text style={styles.controlText}>⟳{ '\n' }翻转</Text></Pressable></View>
      <View style={styles.bottomTabs}><Text style={{ color: idColors.blue }}>拍摄 ●</Text><Pressable onPress={() => router.replace({ pathname: '/album', params })}><Text>相册</Text></Pressable></View>
    </>}
  </SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#FFFFFF' }, cameraArea: { flex: 1, backgroundColor: '#222222' }, top: { backgroundColor: '#00000055', paddingHorizontal: 20, height: 56, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, whiteText: { color: '#FFFFFF', fontSize: 17 }, whiteIcon: { color: '#FFFFFF', fontSize: 30 }, guide: { position: 'absolute', alignSelf: 'center', top: 72, borderRadius: 30, backgroundColor: '#FFA511', paddingVertical: 9, paddingHorizontal: 20 }, guideText: { color: '#FFFFFF', fontSize: 16 }, controls: { padding: 20, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' }, shutter: { width: 80, height: 80, borderRadius: 40, backgroundColor: idColors.blue, borderWidth: 5, borderColor: '#BCC0FA', alignItems: 'center', justifyContent: 'center' }, controlText: { textAlign: 'center', fontSize: 18, lineHeight: 28 }, bottomTabs: { flexDirection: 'row', justifyContent: 'center', gap: 35, paddingBottom: 18 }, confirm: { flexDirection: 'row', justifyContent: 'space-around', padding: 25 }, confirmButton: { alignItems: 'center', gap: 10 }, confirmText: { fontSize: 20 }, confirmIcon: { fontSize: 48 }, permission: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 24 }, permissionText: { fontSize: 18 } });
