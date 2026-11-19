import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Dropdown, type DropdownOption } from '@/components/dropdown';
import { EmojiPicker } from '@/components/emoji-picker';
import { FormCard, FormRow } from '@/components/form';
import { GroupMarkView, startingColor, useGroupMark } from '@/components/group-mark';
import { Icon } from '@/components/icon';
import { IconPicker } from '@/components/icon-picker';
import { SheetScreen } from '@/components/screen';
import { SheetHeader } from '@/components/sheet-header';
import { Text } from '@/components/text';
import { MARK_COLORS, type GroupMark, type MarkColor } from '@/domain/types';
import { useStore } from '@/store';
import { markHues, spacing, useColors } from '@/theme';
import { closeSheet } from '@/utils/close-sheet';
import { haptic } from '@/utils/haptics';

type Style = 'none' | GroupMark['kind'];

const STYLES: DropdownOption<Style>[] = [
  { value: 'none', label: 'None' },
  { value: 'dot', label: 'Dot' },
  { value: 'icon', label: 'Icon' },
  { value: 'emoji', label: 'Emoji' },
];

const STARTING_ICON: Record<string, string> = {
  Daily: 'wallet',
  Savings: 'pig-money',
  Bills: 'receipt',
  Subscriptions: 'repeat',
  'Debt payments': 'credit-card',
};

const STARTING_EMOJI: Record<string, string> = {
  Daily: '🛍️',
  Savings: '🐷',
  Bills: '🧾',
  Subscriptions: '🔁',
  'Debt payments': '💳',
};

/** Picks what sits before a group's name on the Budget: nothing, a dot, a Tabler icon or an emoji. */
export function GroupLook({ group }: { group: string }) {
  const colors = useColors();
  const saved = useGroupMark(group);
  const updateSettings = useStore((s) => s.updateSettings);
  const [style, setStyle] = useState<Style>(saved?.kind ?? 'none');
  const [color, setColor] = useState<MarkColor>(saved && saved.kind !== 'emoji' ? saved.color : startingColor(group));
  const [icon, setIcon] = useState(saved?.kind === 'icon' ? saved.icon : STARTING_ICON[group] ?? 'wallet');
  const [emoji, setEmoji] = useState(saved?.kind === 'emoji' ? saved.emoji : STARTING_EMOJI[group] ?? '✉️');

  const mark: GroupMark | null =
    style === 'dot'
      ? { kind: 'dot', color }
      : style === 'icon'
        ? { kind: 'icon', icon, color }
        : style === 'emoji'
          ? { kind: 'emoji', emoji }
          : null;

  function save() {
    const marks = { ...useStore.getState().settings.groupMarks };
    if (mark) marks[group] = mark;
    else delete marks[group];
    updateSettings({ groupMarks: marks });
    haptic('success');
    closeSheet();
  }

  return (
    <SheetScreen>
      <SheetHeader title={group} />
      <Card>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm + 1,
            paddingHorizontal: spacing.md + 2,
            paddingVertical: spacing.md - 1,
          }}
        >
          {mark && (
            <View style={{ width: 18, alignItems: 'center' }}>
              <GroupMarkView mark={mark} size={18} />
            </View>
          )}
          <Text variant="section" style={{ flex: 1 }} numberOfLines={1}>
            {group}
          </Text>
        </View>
      </Card>
      <FormCard>
        <Dropdown variant="row" label="Style" value={style} options={STYLES} onChange={setStyle} />
        {(style === 'dot' || style === 'icon') && (
          <FormRow label="Color">
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {MARK_COLORS.map((c) => {
                const on = c === color;
                return (
                  <Pressable
                    key={c}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={c}
                    hitSlop={3}
                    onPress={() => {
                      haptic('selection');
                      setColor(c);
                    }}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: markHues[c],
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: on ? 2 : 0,
                      borderColor: colors.surface,
                      outlineWidth: on ? 2 : 0,
                      outlineColor: markHues[c],
                      outlineStyle: 'solid',
                    }}
                  >
                    {on && <Icon sf="checkmark" md="check" size={11} color="#FFFFFF" weight="bold" />}
                  </Pressable>
                );
              })}
            </View>
          </FormRow>
        )}
      </FormCard>
      {style === 'icon' && <IconPicker value={icon} color={markHues[color]} onChange={setIcon} />}
      {style === 'emoji' && <EmojiPicker value={emoji} onChange={setEmoji} />}
      <Button title="Save" size="lg" onPress={save} />
    </SheetScreen>
  );
}
