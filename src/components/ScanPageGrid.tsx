import React, { useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, type GestureResponderEvent, type LayoutRectangle } from 'react-native';
import type { ScanPage } from '../lib/scanner';

export function ScanPageGrid({ pages, selected, disabled, onEdit, onToggle, onDrop }: { pages: ScanPage[]; selected: string[]; disabled: boolean; onEdit: (index: number) => void; onToggle: (id: string) => void; onDrop: (id: string, target: number) => void }) {
  const [height, setHeight] = useState(0);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number; target: number } | null>(null);
  const dragRef = useRef<{ id: string; x: number; y: number; target: number; top: number; left: number; initialScroll: number; pointerX: number; pointerY: number } | null>(null);
  const suppressTap = useRef(false);
  const bounds = useRef<Record<string, LayoutRectangle>>({});
  const grid = useRef<View>(null);
  const scroll = useRef<ScrollView>(null);
  const viewportView = useRef<View>(null);
  const scrollOffset = useRef(0);
  const viewport = useRef({ top: 0, height: 0, contentHeight: 0 });
  const pressed = useRef(false);
  const start = (id: string, index: number, event: GestureResponderEvent) => {
    const { pageX, pageY } = event.nativeEvent;
    suppressTap.current = true;
    grid.current?.measureInWindow((left, top) => {
      if (!pressed.current) return;
      viewportView.current?.measureInWindow((_left, viewportTop, _width, viewportHeight) => {
        viewport.current.top = viewportTop; viewport.current.height = viewportHeight;
      });
      dragRef.current = { id, x: pageX, y: pageY, pointerX: pageX, pointerY: pageY, target: index, top, left, initialScroll: scrollOffset.current };
      setDrag({ id, x: 0, y: 0, target: index });
    });
  };
  const updateTarget = (pageX: number, pageY: number) => {
    const origin = dragRef.current;
    if (!origin) return;
    origin.pointerX = pageX; origin.pointerY = pageY;
    const scrollDelta = scrollOffset.current - origin.initialScroll;
    const x = pageX - origin.left; const y = pageY - origin.top + scrollDelta;
    const target = pages.findIndex((page) => { const rect = bounds.current[page.id]; return rect && x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height; });
    if (target >= 0) origin.target = target;
    setDrag({ id: origin.id, x: pageX - origin.x, y: pageY - origin.y + scrollDelta, target: origin.target });
  };
  const move = (event: GestureResponderEvent) => updateTarget(event.nativeEvent.pageX, event.nativeEvent.pageY);
  const end = (cancel = false) => {
    const origin = dragRef.current;
    dragRef.current = null; setDrag(null);
    if (origin && !cancel) onDrop(origin.id, origin.target);
    // The release may also dispatch Pressable.onPress; suppress only that tap.
    setTimeout(() => { suppressTap.current = false; }, 0);
  };
  const dragging = !!drag;
  useEffect(() => {
    if (!dragging) return;
    const timer = setInterval(() => {
      const origin = dragRef.current;
      if (!origin) return;
      const { top, height: available, contentHeight } = viewport.current;
      const direction = origin.pointerY < top + 48 ? -1 : origin.pointerY > top + available - 48 ? 1 : 0;
      const offset = Math.max(0, Math.min(Math.max(0, contentHeight - available), scrollOffset.current + direction * 18));
      if (offset !== scrollOffset.current) scroll.current?.scrollTo({ y: offset, animated: false });
    }, 80);
    return () => clearInterval(timer);
  }, [dragging]);
  // Two complete rows, including page labels, fit the measured available space.
  const photoHeight = Math.max(60, Math.floor((height - 38) / 2) - 25);
  return <View ref={viewportView} style={styles.container} onLayout={(event) => setHeight(event.nativeEvent.layout.height)}>
    <Text style={styles.hint}>点击图片编辑 · 长按图片拖动排序</Text>
    <ScrollView ref={scroll} scrollEnabled={!drag} style={styles.container} scrollEventThrottle={16} onContentSizeChange={(_width, contentHeight) => { viewport.current.contentHeight = contentHeight; }} onScroll={(event) => { scrollOffset.current = event.nativeEvent.contentOffset.y; const origin = dragRef.current; if (origin) updateTarget(origin.pointerX, origin.pointerY); }}>
      <View ref={grid} style={styles.grid} onMoveShouldSetResponderCapture={() => !!dragRef.current} onResponderMove={move} onResponderRelease={() => end()} onResponderTerminate={() => end(true)} onResponderTerminationRequest={() => false} onTouchMove={move} onTouchEnd={() => { pressed.current = false; end(); }} onTouchCancel={() => { pressed.current = false; end(true); }}>
        {pages.map((page, index) => <View key={page.id} onLayout={(event) => { bounds.current[page.id] = event.nativeEvent.layout; }} style={[styles.item, drag?.id === page.id && { zIndex: 10, transform: [{ translateX: drag.x }, { translateY: drag.y }], opacity: 0.8 }]}>
          <Pressable disabled={disabled} delayLongPress={350} onPressIn={() => { pressed.current = true; }} onLongPress={(event) => start(page.id, index, event)} onPress={() => { if (suppressTap.current) { suppressTap.current = false; return; } onEdit(index); }} accessibilityLabel={`第 ${index + 1} 页，长按拖动排序`} style={[styles.photo, { height: photoHeight }, drag?.target === index && styles.dropTarget]}><Image source={{ uri: page.image.uri }} style={styles.image} resizeMode="contain" /></Pressable>
          <Pressable disabled={disabled || !!drag} onPress={() => onToggle(page.id)} style={[styles.checkbox, selected.includes(page.id) && styles.checked]} accessibilityLabel={`${selected.includes(page.id) ? '取消选择' : '选择'}第 ${index + 1} 页`}><Text style={styles.checkText}>{selected.includes(page.id) ? '✓' : ''}</Text></Pressable>
          <Text style={styles.number}>{String(index + 1).padStart(2, '0')} · ⠿</Text>
        </View>)}
      </View>
    </ScrollView>
  </View>;
}
const styles = StyleSheet.create({ container: { flex: 1, minHeight: 0 }, hint: { color: '#7B838B', fontSize: 11, paddingHorizontal: 12, paddingVertical: 3 }, grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 10, paddingBottom: 4, columnGap: '4%', rowGap: 8 }, item: { width: '48%' }, photo: { backgroundColor: '#FFFFFF', borderRadius: 5, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' }, dropTarget: { borderColor: '#087F75' }, image: { width: '100%', height: '100%' }, checkbox: { position: 'absolute', top: 6, right: 6, width: 30, height: 30, borderRadius: 5, borderWidth: 2, borderColor: '#8F999F', backgroundColor: '#FFFFFFCC', alignItems: 'center', justifyContent: 'center' }, checked: { borderColor: '#087F75', backgroundColor: '#087F75' }, checkText: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' }, number: { textAlign: 'center', color: '#333A40', height: 23, paddingTop: 3, fontSize: 12 } });
