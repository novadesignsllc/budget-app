import { View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { FullWindowOverlay } from 'react-native-screens';

import { useSession } from '@/sync/session';
import { useSyncStatus, type SyncPhase } from '@/sync/status';
import { palettes, radius, shadows, spacing } from '@/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

import { useFloatingBottom } from './floating-action';
import { Icon } from './icon';
import { Text } from './text';

const LABEL: Record<SyncPhase, string> = {
  idle: '',
  syncing: 'Syncing',
  waiting: 'Saved here. Waiting for a connection to sync.',
  synced: 'Synced',
  error: 'Didn’t sync',
};

const TRACK = 32;
const THUMB = 14;
const slide = {
  from: { transform: [{ translateX: 0 }] },
  to: { transform: [{ translateX: TRACK - THUMB }] },
};

/**
 * A small pill in the bottom-left corner, above everything. A green bar runs while
 * changes are uploading to Firebase; it turns into a green check once Firebase has
 * them, then fades away. Hidden when there's nothing to sync.
 */
export function SyncIndicator() {
  const phase = useSyncStatus((s) => s.phase);
  const signedIn = useSession((s) => s.status === 'signedIn');
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = palettes[scheme];
  const reduceMotion = useReducedMotion();
  const floatingBottom = useFloatingBottom();

  const visible = signedIn && phase !== 'idle';
  // Same row as the screen's add button, above the tab bar and quick-add bar.
  const bottom = floatingBottom + 3;
  const green = colors.positive;
  const busy = phase === 'syncing' || phase === 'waiting';

  const pill = (
    <View pointerEvents="none" style={{ position: 'absolute', left: spacing.lg, bottom }}>
      <Animated.View
        accessibilityLiveRegion="polite"
        accessibilityLabel={LABEL[phase]}
        style={{
          opacity: visible ? 1 : 0,
          transitionProperty: 'opacity',
          transitionDuration: 250,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          height: 28,
          paddingHorizontal: phase === 'synced' ? 0 : spacing.md,
          width: phase === 'synced' ? 28 : undefined,
          justifyContent: 'center',
          borderRadius: radius.full,
          backgroundColor: phase === 'synced' ? green : colors.floating,
          borderWidth: phase === 'synced' ? 0 : 0.5,
          borderColor: colors.hairline,
          boxShadow: shadows.float,
        }}
      >
        {busy && (
          <View
            style={{
              width: TRACK,
              height: 4,
              borderRadius: radius.full,
              backgroundColor: colors.positiveSoft,
              overflow: 'hidden',
            }}
          >
            <Animated.View
              style={[
                { width: THUMB, height: 4, borderRadius: radius.full, backgroundColor: green },
                reduceMotion
                  ? { width: TRACK, opacity: 0.6 }
                  : {
                      animationName: slide,
                      animationDuration: '900ms',
                      animationIterationCount: 'infinite',
                      animationDirection: 'alternate',
                      animationTimingFunction: 'ease-in-out',
                    },
              ]}
            />
          </View>
        )}
        {phase === 'waiting' && (
          <Text variant="caption" tone="textSecondary">
            Waiting for signal
          </Text>
        )}
        {phase === 'synced' && <Icon sf="checkmark" md="check" size={14} color="#FFFFFF" weight="bold" />}
        {phase === 'error' && (
          <>
            <Icon sf="exclamationmark.circle.fill" md="error" size={14} color={colors.negative} />
            <Text variant="caption" tone="negative">
              Didn’t sync
            </Text>
          </>
        )}
      </Animated.View>
    </View>
  );

  // On iOS, a full-window overlay keeps it above sheets too.
  return process.env.EXPO_OS === 'ios' ? <FullWindowOverlay>{pill}</FullWindowOverlay> : pill;
}
