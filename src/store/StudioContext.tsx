import React, { createContext, useContext, useMemo, useState } from 'react';
import type { FeatureMode, PhotoAsset } from '../types';

type StudioContextValue = {
  photos: PhotoAsset[];
  setPhotos: (photos: PhotoAsset[]) => void;
  mode: FeatureMode;
  setMode: (mode: FeatureMode) => void;
  ratio: number;
  setRatio: (ratio: number) => void;
  layoutId: string;
  setLayoutId: (layoutId: string) => void;
};

const StudioContext = createContext<StudioContextValue | null>(null);

export function StudioProvider({ children }: React.PropsWithChildren) {
  const [photos, setPhotos] = useState<PhotoAsset[]>([]);
  const [mode, setMode] = useState<FeatureMode>('quick');
  const [ratio, setRatio] = useState(1);
  const [layoutId, setLayoutId] = useState('split-v');

  const value = useMemo(
    () => ({ photos, setPhotos, mode, setMode, ratio, setRatio, layoutId, setLayoutId }),
    [photos, mode, ratio, layoutId]
  );

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}

export function useStudio() {
  const value = useContext(StudioContext);
  if (!value) {
    throw new Error('useStudio must be used inside StudioProvider');
  }
  return value;
}
