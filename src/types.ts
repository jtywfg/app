export type FeatureMode = 'quick' | 'layout' | 'free' | 'single' | 'long' | 'nine' | 'idphoto' | 'idphoto-background';

export type PhotoAsset = {
  uri: string;
  width: number;
  height: number;
  fileName?: string | null;
};

export type NormalizedSlot = {
  x: number;
  y: number;
  width: number;
  height: number;
};
