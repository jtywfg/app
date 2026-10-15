export type PortraitEffects = { smooth: number; brighten: number; detail: number; lipstick: number; blush: number; tone: number };
export const NO_PORTRAIT_EFFECTS: PortraitEffects = { smooth: 0, brighten: 0, detail: 0, lipstick: 0, blush: 0, tone: 0 };
export const BEAUTY_CONTROLS = [{ key: 'smooth', label: '细腻磨皮' }, { key: 'brighten', label: '肤色提亮' }, { key: 'detail', label: '质感清晰' }] as const;
export const MAKEUP_CONTROLS = [{ key: 'lipstick', label: '自然唇色' }, { key: 'blush', label: '柔和腮红' }, { key: 'tone', label: '均匀肤色' }] as const;
export const PORTRAIT_PRESETS: { label: string; effects: PortraitEffects }[] = [
  { label: '原貌', effects: NO_PORTRAIT_EFFECTS },
  { label: '自然', effects: { smooth: 25, brighten: 20, detail: 15, lipstick: 12, blush: 8, tone: 15 } },
  { label: '清透', effects: { smooth: 40, brighten: 40, detail: 20, lipstick: 18, blush: 12, tone: 30 } },
  { label: '好气色', effects: { smooth: 30, brighten: 25, detail: 15, lipstick: 40, blush: 30, tone: 25 } },
];
