import type { ImageSourcePropType } from 'react-native';

export type SuitGroup = '女装' | '男装' | '童装';
export type FormalwearTemplate = { id: string; label: string; source?: ImageSourcePropType; width?: number; height?: number };

// Static requires ensure Metro includes every garment in the offline APK.
export const FORMALWEAR: Record<SuitGroup, FormalwearTemplate[]> = {
  男装: [
    { id: 'men-01', label: '男装01', source: require('../../assets/formalwear/prepared/men/01.png'), width: 600, height: 476 },
    { id: 'men-02', label: '男装02', source: require('../../assets/formalwear/prepared/men/02.png'), width: 600, height: 442 },
    { id: 'men-03', label: '男装03', source: require('../../assets/formalwear/prepared/men/03.png'), width: 600, height: 432 },
    { id: 'men-04', label: '男装04', source: require('../../assets/formalwear/prepared/men/04.png'), width: 600, height: 367 },
    { id: 'men-05', label: '男装05', source: require('../../assets/formalwear/prepared/men/05.png'), width: 1134, height: 966 },
    { id: 'men-06', label: '男装06', source: require('../../assets/formalwear/prepared/men/06.png'), width: 600, height: 409 },
    { id: 'men-07', label: '男装07', source: require('../../assets/formalwear/prepared/men/07.png'), width: 600, height: 463 },
    { id: 'men-08', label: '男装08', source: require('../../assets/formalwear/prepared/men/08.png'), width: 600, height: 360 },
    { id: 'men-09', label: '男装09', source: require('../../assets/formalwear/prepared/men/09.png'), width: 400, height: 299 },
    { id: 'men-10', label: '男装10', source: require('../../assets/formalwear/prepared/men/10.png'), width: 512, height: 317 },
    { id: 'men-11', label: '男装11', source: require('../../assets/formalwear/prepared/men/11.png'), width: 322, height: 288 },
    { id: 'men-12', label: '男装12', source: require('../../assets/formalwear/prepared/men/12.png'), width: 320, height: 245 },
    { id: 'men-13', label: '男装13', source: require('../../assets/formalwear/prepared/men/13.png'), width: 1080, height: 695 },
    { id: 'men-14', label: '男装14', source: require('../../assets/formalwear/prepared/men/14.png'), width: 1080, height: 641 },
  ],
  女装: [
    { id: 'women-01', label: '女装01', source: require('../../assets/formalwear/prepared/women/01.png'), width: 644, height: 482 },
    { id: 'women-02', label: '女装02', source: require('../../assets/formalwear/prepared/women/02.png'), width: 1046, height: 860 },
    { id: 'women-03', label: '女装03', source: require('../../assets/formalwear/prepared/women/03.png'), width: 266, height: 362 },
    { id: 'women-04', label: '女装04', source: require('../../assets/formalwear/prepared/women/04.png'), width: 545, height: 558 },
  ],
  童装: [
    { id: '童装1', label: '商务西装' },
    { id: '童装2', label: '白衬衫' },
    { id: '童装3', label: '深蓝正装' },
  ],
};

export function getFormalwearTemplate(id: string) {
  return Object.values(FORMALWEAR).flat().find((item) => item.id === id);
}
