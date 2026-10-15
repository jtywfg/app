import React, { useId, useRef } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Svg, { Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';
import { DEFAULT_SUIT_PLACEMENT, getIDPhotoSuitTransform, getRasterSuitRect, suitPlacementTransform, type SuitPlacement } from '../lib/idphotoSuitLayout';
import { getFormalwearTemplate } from '../lib/formalwear';

export function IDPhotoSuit({ styleId, width, height, thumbnail = false, placement = DEFAULT_SUIT_PLACEMENT, onLoad, onError }: { styleId: string; width: number; height: number; thumbnail?: boolean; placement?: SuitPlacement; onLoad?: () => void; onError?: () => void }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  if (styleId === 'none') return null;
  const template = getFormalwearTemplate(styleId);
  if (template?.source && template.width && template.height) {
    if (thumbnail) return <Image source={template.source} style={{ width, height }} resizeMode="contain" />;
    // Match the existing collar landmark and placement coordinate system.
    // Compensate for the portrait aspect ratio to retain the garment's proportions.
    const rectangle = getRasterSuitRect(template.width, template.height, width, height);
    return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { transformOrigin: '50% 100%', transform: [{ translateX: placement.x * width }, { translateY: placement.y * height }, { rotate: `${placement.rotation}deg` }, { scale: placement.scale }] }]}><Image source={template.source} resizeMode="stretch" onLoad={onLoad} onError={onError} style={{ position: 'absolute', left: rectangle.x / 300 * width, top: rectangle.y / 420 * height, width: rectangle.width / 300 * width, height: rectangle.height / 420 * height }} /></View>;
  }
  const whiteShirt = styleId.endsWith('2');
  const color = whiteShirt ? '#F4F5F8' : styleId.endsWith('3') ? '#253D60' : '#25262D';
  return <Svg pointerEvents="none" width={width} height={height} viewBox={thumbnail ? '0 245 300 175' : '0 0 300 420'} style={thumbnail ? undefined : StyleSheet.absoluteFill} preserveAspectRatio={thumbnail ? 'xMidYMid meet' : 'none'}>
    <Defs>
      <LinearGradient id={id + 'fabric'} x1="0%" y1="0%" x2="100%" y2="70%">
        <Stop offset="0" stopColor={whiteShirt ? '#D7DBE2' : '#121924'} /><Stop offset="0.4" stopColor={color} /><Stop offset="0.65" stopColor={whiteShirt ? '#FFFFFF' : styleId.endsWith('3') ? '#3C5271' : '#41434B'} /><Stop offset="1" stopColor={color} />
      </LinearGradient>
      <LinearGradient id={id + 'shirt'} x1="0%" y1="0%" x2="100%" y2="100%"><Stop offset="0" stopColor="#CDD2DA" /><Stop offset="0.45" stopColor="#FAFBFC" /><Stop offset="1" stopColor="#DDE1E8" /></LinearGradient>
    </Defs>
    {/* The original suit started below the shoulders. Enlarge it around the
        lower center so the collar rises to the neck and the shoulders cover
        the source clothing, while keeping the hem anchored at the photo edge. */}
    <G transform={thumbnail ? undefined : suitPlacementTransform(placement)}><G transform={getIDPhotoSuitTransform()}>
      <Path d="M-60 500 L-60 375 Q-15 340 93 320 L119 305 Q123 324 150 332 Q177 324 181 305 L207 320 Q315 340 360 375 L360 500Z" fill={`url(#${id}fabric)`} />
      {/* Open neck: retain the photographed skin above the curved neckline. */}
      <Path d="M119 305 Q123 324 150 332 Q177 324 181 305 L175 500 L125 500Z" fill={`url(#${id}shirt)`} />
      <Path d="M119 305 L150 326 L136 354 L112 320Z M181 305 L150 326 L164 354 L188 320Z" fill="#ECEFF4" stroke="#CDD2DC" strokeWidth="0.5" />
      {!whiteShirt ? <><Path d="M112 310 L130 345 L119 359 L141 420 L74 336Z M188 310 L170 345 L181 359 L159 420 L226 336Z" fill={styleId.endsWith('3') ? '#1A2E4E' : '#373943'} /><Path d="M143 339 L157 339 L160 352 L151 420 L140 352Z" fill={styleId.startsWith('男') ? '#405377' : '#F5F6F9'} /></> : null}
      <Path d="M24 351 Q48 363 47 420 M276 351 Q252 363 253 420" fill="none" stroke={whiteShirt ? '#B6BDC9' : '#080D17'} strokeOpacity={0.25} strokeWidth={1.2} />
      <Path d="M119 305 Q123 324 150 332 Q177 324 181 305" fill="none" stroke="#000000" strokeOpacity={0.12} strokeWidth={1.2} />
    </G></G>
  </Svg>;
}
export function IDPhotoPortrait({ uri, width, height, suit = 'none', placement, onLoad, onError }: { uri: string; width: number; height: number; suit?: string; placement?: SuitPlacement; onLoad?: () => void; onError?: () => void }) {
  return <PortraitContent key={`${uri}:${suit}:${width}:${height}`} uri={uri} width={width} height={height} suit={suit} placement={placement} onLoad={onLoad} onError={onError} />;
}

function PortraitContent({ uri, width, height, suit, placement, onLoad, onError }: { uri: string; width: number; height: number; suit: string; placement?: SuitPlacement; onLoad?: () => void; onError?: () => void }) {
  const loaded = useRef({ photo: false, suit: !getFormalwearTemplate(suit)?.source });
  const imageLoaded = (part: 'photo' | 'suit') => {
    loaded.current[part] = true;
    if (loaded.current.photo && loaded.current.suit) onLoad?.();
  };
  return <View style={{ width, height, overflow: 'hidden' }}><Image source={{ uri }} style={{ width, height }} onLoad={() => imageLoaded('photo')} onError={onError} resizeMode="stretch" /><IDPhotoSuit styleId={suit} width={width} height={height} placement={placement} onLoad={() => imageLoaded('suit')} onError={onError} /></View>;
}
