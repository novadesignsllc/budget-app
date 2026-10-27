import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/button';
import { FormCard, FormRow, InputRow } from '@/components/form';
import { Icon } from '@/components/icon';
import { SheetScreen } from '@/components/screen';
import { SheetHeader } from '@/components/sheet-header';
import { Text } from '@/components/text';
import { useToast } from '@/components/toast';
import { EmojiHeader } from '@/screens/envelope-settings';
import { MAX_PROFILES, newProfileId, saveProfile, useProfiles, type Profile } from '@/sync/profiles';
import { switchProfile, useSession } from '@/sync/session';
import { ACCENTS, spacing, useColors } from '@/theme';
import { closeSheet } from '@/utils/close-sheet';
import { haptic } from '@/utils/haptics';

/**
 * Adds a profile (a whole separate budget) or edits one's name, icon and color. A new
 * profile starts empty and opens right away.
 */
export function EditProfile({ id }: { id?: string }) {
  const colors = useColors();
  const user = useSession((s) => s.user);
  const list = useProfiles((s) => s.list);
  const existing = list.find((p) => p.id === id);
  const showToast = useToast((s) => s.show);
  const used = new Set(list.filter((p) => p.id !== id).map((p) => p.color));
  const [name, setName] = useState(existing?.name ?? '');
  const [emoji, setEmoji] = useState(existing?.emoji ?? '💼');
  const [color, setColor] = useState<string>(
    existing?.color ?? ACCENTS.find((a) => !used.has(a.hex))?.hex ?? ACCENTS[1].hex,
  );
  const [busy, setBusy] = useState(false);

  const full = !existing && list.length >= MAX_PROFILES;
  const trimmed = name.trim();

  async function save() {
    if (!user || !trimmed || full) return;
    const profile: Profile = existing
      ? { ...existing, name: trimmed, emoji, color }
      : { id: newProfileId(), name: trimmed, emoji, color, order: Math.max(0, ...list.map((p) => p.order)) + 1 };
    setBusy(true);
    // Shows up right away; it reaches Firebase in the background.
    void saveProfile(user.uid, profile).catch(() =>
      showToast({ message: 'That didn’t save. Try again when you’re online.' }),
    );
    useProfiles.setState({
      list: [...list.filter((p) => p.id !== profile.id), profile].sort((a, b) => a.order - b.order),
    });
    haptic('success');
    closeSheet();
    if (!existing) {
      switchProfile(profile.id);
      showToast({ message: `${profile.name} is ready. It starts empty.` });
    }
  }

  if (full) {
    return (
      <SheetScreen>
        <SheetHeader title="Profiles" />
        <Text variant="callout" tone="textSecondary" align="center">
          You have {MAX_PROFILES} profiles, the most there can be.
        </Text>
      </SheetScreen>
    );
  }

  return (
    <SheetScreen>
      <SheetHeader title={existing ? 'Edit profile' : 'New profile'} />
      <EmojiHeader emoji={emoji} onChange={setEmoji} />
      <FormCard>
        <InputRow
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="Business, Household…"
          autoFocus={!existing}
          autoCapitalize="words"
          returnKeyType="done"
          onSubmitEditing={save}
        />
        <FormRow label="Color">
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {ACCENTS.map((a) => {
              const on = a.hex === color;
              return (
                <Pressable
                  key={a.hex}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={a.name}
                  hitSlop={4}
                  onPress={() => {
                    haptic('selection');
                    setColor(a.hex);
                  }}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    backgroundColor: a.hex,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: on ? 2 : 0,
                    borderColor: colors.surface,
                    outlineWidth: on ? 2 : 0,
                    outlineColor: a.hex,
                    outlineStyle: 'solid',
                  }}
                >
                  {on && <Icon sf="checkmark" md="check" size={12} color="#FFFFFF" weight="bold" />}
                </Pressable>
              );
            })}
          </View>
        </FormRow>
      </FormCard>
      <Button title={existing ? 'Save' : 'Add profile'} size="lg" disabled={!trimmed || busy} onPress={save} />
    </SheetScreen>
  );
}
