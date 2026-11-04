import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';

import { cardFaces, radius } from '@/theme';

/** A tiny card face for list rows: an account's face, or a debt's chart color. */
export function MiniCard({ face, color, width = 32 }: { face?: number; color?: string; width?: number }) {
  const height = Math.round(width * 0.66);
  if (color) return <View style={{ width, height, borderRadius: radius.tiny, backgroundColor: color }} />;
  const f = cardFaces[(face ?? 0) % cardFaces.length];
  return (
    <LinearGradient
      colors={[f.from, f.to]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width, height, borderRadius: radius.tiny, borderWidth: f.ink === '#FFFFFF' ? 0 : 1, borderColor: 'rgba(20,40,80,0.1)' }}
    />
  );
}
