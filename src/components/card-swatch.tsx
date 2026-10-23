import { LinearGradient } from 'expo-linear-gradient';

import { cardFaces } from '@/theme';

/** A tiny card face for list rows, so a debt in the list matches its card above. */
export function CardSwatch({ face }: { face: number }) {
  const f = cardFaces[face % cardFaces.length];
  return (
    <LinearGradient
      colors={[f.from, f.to]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: 34, height: 22, borderRadius: 5, borderCurve: 'continuous' }}
    />
  );
}
