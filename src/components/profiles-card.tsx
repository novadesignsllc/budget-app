import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { MAX_PROFILES, useProfiles } from '@/sync/profiles';
import { spacing, useColors } from '@/theme';

import { Card, CardHeader } from './card';
import { Icon } from './icon';
import { Text } from './text';

/** Settings' list of profiles: tap one to rename it or change its icon and color, or add one (up to three). */
/** `bare` drops the title row (the desktop's Settings section has one). */
export function ProfilesCard({ bare }: { bare?: boolean } = {}) {
  const colors = useColors();
  const list = useProfiles((s) => s.list);
  const activeId = useProfiles((s) => s.activeId);
  return (
    <Card>
      {!bare && <CardHeader title="Profiles" detail={`${list.length} of ${MAX_PROFILES}`} />}
      {list.map((p) => (
        <Pressable
          key={p.id}
          accessibilityRole="button"
          accessibilityLabel={`${p.name}${p.id === activeId ? ', open now' : ''}. Edit`}
          onPress={() => router.push({ pathname: '/edit-profile', params: { id: p.id } })}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            paddingHorizontal: spacing.md + 2,
            paddingVertical: 10,
            borderTopWidth: 1,
            borderTopColor: colors.hairline,
            backgroundColor: pressed ? colors.control : colors.surface,
          })}
        >
          <Text style={{ fontSize: 20, lineHeight: 26, width: 26, textAlign: 'center' }}>{p.emoji}</Text>
          <Text variant="body" weight="500" style={{ flex: 1 }} numberOfLines={1}>
            {p.name}
          </Text>
          {p.id === activeId && (
            <Text variant="footnote" tone="textSecondary">
              Open now
            </Text>
          )}
          {/* Its color, as a plain swatch. */}
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: p.color }} />
          <Icon sf="chevron.right" md="chevron_right" size={12} color={colors.textTertiary} weight="semibold" />
        </Pressable>
      ))}
      {list.length < MAX_PROFILES && (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/edit-profile')}
          style={({ pressed }) => ({
            paddingHorizontal: spacing.md + 2,
            paddingVertical: 12,
            borderTopWidth: 1,
            borderTopColor: colors.separator,
            backgroundColor: pressed ? colors.control : colors.surface,
          })}
        >
          <Text variant="callout" weight="600" tone="accent">
            Add profile
          </Text>
        </Pressable>
      )}
    </Card>
  );
}
