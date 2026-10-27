import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { switchProfile } from '@/sync/session';
import { useProfiles, type Profile } from '@/sync/profiles';
import { spacing, useColors } from '@/theme';
import { haptic } from '@/utils/haptics';

import { PROFILE_BAR_HEIGHT } from './dock';
import { Text } from './text';

/**
 * Profile tabs along the bottom, like the sheet tabs in Google Sheets: the profile you're
 * in is a raised tab with its color along the top; tap another to switch. With one
 * profile it just shows its name. New profiles are added in Settings.
 */
export function ProfileBar({ paddingBottom = 0 }: { paddingBottom?: number }) {
  const colors = useColors();
  const list = useProfiles((s) => s.list);
  const activeId = useProfiles((s) => s.activeId);
  const switching = useProfiles((s) => s.switching);
  return (
    <View
      style={{
        backgroundColor: colors.background,
        borderTopWidth: 1,
        borderTopColor: colors.separator,
        paddingBottom,
      }}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          height: PROFILE_BAR_HEIGHT,
          alignItems: 'flex-start',
          paddingHorizontal: spacing.sm,
          gap: 2,
        }}
      >
        {list.map((p) => (
          <ProfileTab
            key={p.id}
            profile={p}
            active={p.id === activeId}
            loading={switching && p.id === activeId}
            onlyOne={list.length === 1}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function ProfileTab({
  profile,
  active,
  loading,
  onlyOne,
}: {
  profile: Profile;
  active: boolean;
  loading: boolean;
  onlyOne: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${profile.name} profile`}
      disabled={active || onlyOne}
      onPress={() => {
        haptic('selection');
        switchProfile(profile.id);
      }}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ({
        height: 30,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        marginTop: -1,
        borderBottomLeftRadius: 8,
        borderBottomRightRadius: 8,
        // The open profile is a raised tab, its color along the top edge.
        borderTopWidth: 2,
        borderTopColor: active ? profile.color : 'transparent',
        backgroundColor: active ? colors.surface : pressed || hovered ? colors.control : 'transparent',
        borderLeftWidth: active ? 1 : 0,
        borderRightWidth: active ? 1 : 0,
        borderBottomWidth: active ? 1 : 0,
        borderColor: colors.separator,
      })}
    >
      {loading ? (
        <ActivityIndicator size="small" color={profile.color} />
      ) : (
        <Text style={{ fontSize: 13, lineHeight: 16 }}>{profile.emoji}</Text>
      )}
      <Text
        variant="callout"
        weight={active ? '600' : '500'}
        color={active ? colors.text : colors.textSecondary}
        numberOfLines={1}
      >
        {profile.name}
      </Text>
    </Pressable>
  );
}
