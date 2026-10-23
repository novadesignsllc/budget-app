import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

import { Text } from './text';

type TextProps = React.ComponentProps<typeof Text>;

/**
 * A number that counts to its new value (about 400ms, easing out) instead of jumping.
 * Shows the value as-is on first render and with Reduce Motion on.
 */
export function AnimatedNumber({
  value,
  format,
  ...props
}: Omit<TextProps, 'children'> & { value: number; format: (v: number) => string }) {
  const reduceMotion = useReducedMotion();
  const [shown, setShown] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    const start = from.current;
    from.current = value;
    if (reduceMotion || start === value) {
      setShown(value);
      return;
    }
    const began = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - began) / 400);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(start + (value - start) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, reduceMotion]);

  return (
    <Text {...props} style={[{ fontVariant: ['tabular-nums'] }, props.style]}>
      {format(shown)}
    </Text>
  );
}
