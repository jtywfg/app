import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

export const idColors = { blue: '#454BFF', canvas: '#F5F6FA', ink: '#171717', muted: '#929397' };
export function IDPhotoHeader({ title, onBack }: { title: string; onBack?: () => void }) {
  const router = useRouter();
  return <View style={chrome.header}><Pressable style={chrome.backButton} onPress={onBack ?? (() => router.back())} accessibilityLabel="返回"><Text style={chrome.back}>‹</Text></Pressable><Text style={chrome.title}>{title}</Text><View style={chrome.backButton} /></View>;
}
export function IDPhotoButton({ title, onPress, disabled = false, outline = false }: { title: string; onPress: () => void; disabled?: boolean; outline?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[chrome.button, outline && chrome.outline, disabled && { opacity: 0.45 }]}><Text style={[chrome.buttonText, outline && { color: idColors.blue }]}>{title}</Text></Pressable>;
}
export const chrome = StyleSheet.create({
  safe: { flex: 1, backgroundColor: idColors.canvas },
  header: { height: 58, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  backButton: { width: 42, height: 48, justifyContent: 'center' },
  back: { color: idColors.ink, fontSize: 44, lineHeight: 46 },
  title: { color: idColors.ink, fontSize: 20, fontWeight: '600' },
  button: { minHeight: 52, borderRadius: 12, backgroundColor: idColors.blue, borderWidth: 1.5, borderColor: idColors.blue, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, flex: 1 },
  buttonText: { fontSize: 19, color: '#FFFFFF', fontWeight: '500' },
  outline: { backgroundColor: '#FFFFFF' },
  bottom: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 12, flexDirection: 'row', gap: 16, backgroundColor: '#FFFFFF' },
  card: { backgroundColor: '#FFFFFF', padding: 18, borderRadius: 12, gap: 12, shadowColor: '#000000', shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
});
