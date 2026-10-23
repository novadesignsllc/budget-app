import { useId, useRef, useState } from 'react';
import { InputAccessoryView, Pressable, TextInput, View } from 'react-native';

import { formatDollars } from '@/domain/money';
import type { Cents } from '@/domain/types';
import { radius, spacing, type as typeScale, useColors } from '@/theme';
import { haptic } from '@/utils/haptics';

import { Text } from './text';

const ios = process.env.EXPO_OS === 'ios';
/** Inner padding of the box; the box reaches this far past the column so the digits line up. */
const PAD = 6;

/**
 * A whole-dollar amount you tap to edit in place: a soft purple chip that turns into
 * a number field. Done (or Return) saves, Cancel (or Escape) puts it back. On iPhone a
 * bar above the keyboard shows `status` (what's left to assign) with Cancel and Done.
 */
export function InlineAmount({
  cents,
  onCommit,
  onEditingChange,
  onDraft,
  status,
  accessibilityLabel,
  width = 76,
  align = 'right',
  variant = 'row',
  muted,
}: {
  cents: Cents;
  onCommit: (cents: Cents) => void;
  /** Called with the row's view when editing starts, so the screen can scroll it into view. */
  onEditingChange?: (editing: boolean, view: React.ComponentRef<typeof View> | null) => void;
  /** The amount as it's typed, for live previews. */
  onDraft?: (cents: Cents) => void;
  /** One line for the keyboard bar, like "Ready to assign $12". */
  status?: React.ReactNode;
  accessibilityLabel: string;
  width?: number;
  /** Right for table columns; left for a stat under a label. */
  align?: 'left' | 'right';
  variant?: 'row' | 'callout';
  /** Grey instead of purple (a past month). */
  muted?: boolean;
}) {
  const colors = useColors();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const box = useRef<React.ComponentRef<typeof View>>(null);
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);
  const cancelled = useRef(false);
  const needsFocus = useRef(false);
  const accessoryId = `amount-${useId()}`;

  const whole = Math.max(0, Math.floor(cents / 100));
  const draftCents = (parseInt(draft || '0', 10) || 0) * 100;

  function start() {
    haptic('selection');
    cancelled.current = false;
    needsFocus.current = true;
    setDraft(String(whole));
    setEditing(true);
    onDraft?.(whole * 100);
    onEditingChange?.(true, box.current);
  }

  function finish() {
    if (!editing) return;
    setEditing(false);
    onEditingChange?.(false, null);
    if (cancelled.current) return;
    if (draftCents !== whole * 100) {
      haptic('success');
      onCommit(draftCents);
    }
  }

  // One fixed box in both states, so tapping changes nothing but the border and caret:
  // no size change, nothing appears around it. The text lines up with the column edge.
  const boxStyle = {
    width: width + PAD,
    height: 24,
    ...(align === 'right' ? { marginRight: -PAD } : { marginLeft: -PAD }),
    paddingHorizontal: PAD - 1.5,
    borderRadius: 6,
    borderWidth: 1.5,
    justifyContent: 'center',
  } as const;
  const textStyle = {
    ...typeScale[variant],
    fontWeight: variant === 'callout' ? '600' : '400',
    fontVariant: ['tabular-nums'],
    textAlign: align,
    color: colors.text,
  } as const;

  return (
    <View ref={box} collapsable={false} style={{ width, alignItems: align === 'right' ? 'flex-end' : 'flex-start' }}>
      {editing ? (
        <View style={[boxStyle, { borderColor: muted ? colors.textSecondary : colors.accent, backgroundColor: colors.surface }]}>
          <TextInput
            // autoFocus alone doesn't take on web when the field mounts mid-tap, so focus
            // once, a beat after it appears.
            ref={(el) => {
              input.current = el;
              if (el && needsFocus.current) {
                needsFocus.current = false;
                setTimeout(() => el.focus(), 50);
              }
            }}
            autoFocus
            value={draft}
            onChangeText={(t) => {
              const digits = t.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 7);
              setDraft(digits);
              onDraft?.((parseInt(digits || '0', 10) || 0) * 100);
            }}
            onSubmitEditing={finish}
            onBlur={finish}
            onKeyPress={(e) => {
              if (e.nativeEvent.key === 'Escape') {
                cancelled.current = true;
                input.current?.blur();
              }
            }}
            keyboardType="number-pad"
            returnKeyType="done"
            selectTextOnFocus
            inputAccessoryViewID={ios ? accessoryId : undefined}
            accessibilityLabel={accessibilityLabel}
            style={[textStyle, { flex: 1, padding: 0, margin: 0, lineHeight: undefined }]}
          />
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${accessibilityLabel}, ${formatDollars(cents)}. Edit`}
          hitSlop={8}
          onPress={start}
          style={({ pressed }) => [
            boxStyle,
            { borderColor: 'transparent', backgroundColor: pressed ? colors.fill : muted ? colors.control : colors.accentSoft },
          ]}
        >
          <Text numberOfLines={1} style={textStyle}>
            {'$' + whole.toLocaleString('en-US')}
          </Text>
        </Pressable>
      )}
      {ios && editing && (
        <InputAccessoryView nativeID={accessoryId}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              backgroundColor: '#F7F7F9',
              borderTopWidth: 1,
              borderTopColor: colors.separator,
            }}
          >
            <View style={{ flex: 1 }}>
              {typeof status === 'string' ? (
                <Text variant="callout" tone="textSecondary">
                  {status}
                </Text>
              ) : (
                status
              )}
            </View>
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => {
                cancelled.current = true;
                input.current?.blur();
              }}
              style={{ paddingHorizontal: spacing.sm, height: 30, justifyContent: 'center' }}
            >
              <Text variant="body" tone="textSecondary">
                Cancel
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => input.current?.blur()}
              style={({ pressed }) => ({
                height: 30,
                paddingHorizontal: 14,
                borderRadius: radius.button,
                justifyContent: 'center',
                backgroundColor: colors.accent,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text variant="body" weight="600" tone="onInk">
                Done
              </Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      )}
    </View>
  );
}
