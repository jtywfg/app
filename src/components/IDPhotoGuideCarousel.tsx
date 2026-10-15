import React, { useCallback, useRef, useState } from 'react';
import { AppState, Image, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { idColors } from './IDPhotoChrome';

const slides = [
  { source: require('../../assets/idphoto-guide/01.jpg'), label: '建议他人帮助拍摄，便于剪裁' },
  { source: require('../../assets/idphoto-guide/02.jpg'), label: '纯色墙做背景，避免杂乱或与服装颜色过近' },
  { source: require('../../assets/idphoto-guide/03.jpg'), label: '请在光线均匀的环境内拍摄' },
  { source: require('../../assets/idphoto-guide/04.jpg'), label: '抬头挺胸目视前方，对齐参考线' },
];
const INTERVAL = 4000;
const GAP = 12;

export function IDPhotoGuideCarousel() {
  const { width: screenWidth } = useWindowDimensions();
  const width = Math.max(1, screenWidth - 32);
  const step = width + GAP;
  const scroll = useRef<ScrollView>(null);
  const current = useRef(0);
  const lastInteraction = useRef(0);
  const dragging = useRef(false);
  const [index, setIndex] = useState(0);
  const goTo = useCallback((next: number) => {
    current.current = next;
    setIndex(next);
    scroll.current?.scrollTo({ x: next * step, animated: true });
  }, [step]);

  useFocusEffect(useCallback(() => {
    const timer = setInterval(() => {
      if (AppState.currentState !== 'active' || dragging.current || Date.now() - lastInteraction.current < INTERVAL) return;
      goTo((current.current + 1) % slides.length);
    }, INTERVAL);
    return () => clearInterval(timer);
  }, [goTo]));

  return <View style={styles.container}>
    <ScrollView
      ref={scroll}
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={step}
      decelerationRate="fast"
      disableIntervalMomentum
      scrollEventThrottle={16}
      onLayout={() => scroll.current?.scrollTo({ x: current.current * step, animated: false })}
      onScrollBeginDrag={() => { dragging.current = true; lastInteraction.current = Date.now(); }}
      onScrollEndDrag={() => { dragging.current = false; lastInteraction.current = Date.now(); }}
      onMomentumScrollEnd={() => { dragging.current = false; }}
      onScroll={(event) => {
        const next = Math.max(0, Math.min(slides.length - 1, Math.round(event.nativeEvent.contentOffset.x / step)));
        current.current = next;
        setIndex(next);
      }}
      contentContainerStyle={styles.slides}
      style={{ width }}
    >
      {slides.map((slide) => <Image key={slide.label} source={slide.source} accessibilityLabel={slide.label} style={{ width, height: width * 0.75, borderRadius: 12 }} resizeMode="contain" />)}
    </ScrollView>
    <View style={styles.dots}>{slides.map((slide, item) => <Pressable key={slide.label} accessibilityRole="button" accessibilityLabel={`拍照建议 ${item + 1}：${slide.label}`} accessibilityState={{ selected: item === index }} onPress={() => { lastInteraction.current = Date.now(); goTo(item); }} style={styles.dotButton}><View style={[styles.dot, item === index && styles.activeDot]} /></Pressable>)}</View>
  </View>;
}

const styles = StyleSheet.create({
  container: { gap: 4 },
  slides: { gap: GAP },
  dots: { flexDirection: 'row', justifyContent: 'center' },
  dotButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#DDE0EA' },
  activeDot: { backgroundColor: idColors.blue },
});
