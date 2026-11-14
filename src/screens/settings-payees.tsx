import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Card, CardFooterLink, CardHeader, TableHeader } from '@/components/card';
import { Dropdown, type DropdownOption } from '@/components/dropdown';
import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import { useToast } from '@/components/toast';
import { useStore } from '@/store';
import { groupColor, radius, spacing, type as typeScale, useColors } from '@/theme';
import { haptic } from '@/utils/haptics';

const NONE = '__none__';
const READY = '__ready__';
const PREVIEW = 8;
const ENVELOPE_COLUMN = 150;

/** A one-line input row at the top of the card, for search or a new payee's name. */
function InputRow({
  icon,
  value,
  onChangeText,
  placeholder,
  onSubmit,
  trailing,
}: {
  icon: { sf: Parameters<typeof Icon>[0]['sf']; md: Parameters<typeof Icon>[0]['md'] };
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  onSubmit?: () => void;
  trailing?: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: 7,
        borderBottomWidth: 1,
        borderBottomColor: colors.separator,
      }}
    >
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 7,
          height: 32,
          paddingHorizontal: 9,
          borderRadius: radius.button,
          borderCurve: 'continuous',
          backgroundColor: colors.control,
        }}
      >
        <Icon sf={icon.sf} md={icon.md} size={12} color={colors.textTertiary} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          autoFocus
          autoCorrect={false}
          returnKeyType={onSubmit ? 'done' : 'search'}
          onSubmitEditing={onSubmit}
          accessibilityLabel={placeholder}
          style={[typeScale.callout, { flex: 1, height: 32, color: colors.text }]}
        />
      </View>
      {trailing}
    </View>
  );
}

/**
 * Payees and the envelope each one defaults to. Quick-add uses these first.
 * Long-press a payee to delete it.
 */
export function PayeesCard({
  searching,
  adding,
  onDoneAdding,
  bare,
}: {
  searching: boolean;
  adding: boolean;
  onDoneAdding: () => void;
  /** No title row (the desktop's Settings section already has one). */
  bare?: boolean;
}) {
  const colors = useColors();
  const payees = useStore((s) => s.payees);
  const envelopes = useStore((s) => s.envelopes);
  const setPayeeEnvelope = useStore((s) => s.setPayeeEnvelope);
  const setPayeeIncome = useStore((s) => s.setPayeeIncome);
  const addPayee = useStore((s) => s.addPayee);
  const deletePayee = useStore((s) => s.deletePayee);
  const showToast = useToast((s) => s.show);
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);

  const options = useMemo<DropdownOption<string>[]>(() => {
    const spendable = envelopes
      .filter((e) => !e.hidden && !e.debtAccountId)
      .sort((a, b) => a.group.localeCompare(b.group) || a.order - b.order);
    return [
      { value: NONE, label: 'Ask each time' },
      { value: READY, label: 'Ready to assign', dot: colors.positive },
      ...spendable.map((e) => ({ value: e.id, label: e.name, dot: groupColor(e.group), section: e.group })),
    ];
  }, [envelopes, colors.positive]);

  const sorted = useMemo(() => [...payees].sort((a, b) => a.name.localeCompare(b.name)), [payees]);
  const q = searching ? query.trim().toLowerCase() : '';
  const matches = q ? sorted.filter((p) => p.name.toLowerCase().includes(q)) : sorted;
  const shown = q || expanded ? matches : matches.slice(0, PREVIEW);

  const submitNew = () => {
    const trimmed = name.trim();
    if (!trimmed) return onDoneAdding();
    addPayee(trimmed);
    haptic('success');
    showToast({ message: `Added ${trimmed}` });
    setName('');
    onDoneAdding();
  };

  return (
    <Card>
      {!bare && <CardHeader title="Payees" detail={`${payees.length}`} />}
      {adding && (
        <InputRow
          icon={{ sf: 'plus', md: 'add' }}
          value={name}
          onChangeText={setName}
          placeholder="New payee name"
          onSubmit={submitNew}
          trailing={<Button title={name.trim() ? 'Add' : 'Cancel'} size="sm" variant={name.trim() ? 'primary' : 'secondary'} onPress={submitNew} />}
        />
      )}
      {searching && !adding && (
        <InputRow icon={{ sf: 'magnifyingglass', md: 'search' }} value={query} onChangeText={setQuery} placeholder="Search payees" />
      )}
      {sorted.length === 0 ? (
        <Text variant="callout" tone="textSecondary" style={{ padding: spacing.md + 2 }}>
          No payees yet.
        </Text>
      ) : (
        <>
          <TableHeader columns={[{ label: 'Payee' }, { label: 'Goes to', width: ENVELOPE_COLUMN }]} />
          {shown.length === 0 && (
            <Text variant="callout" tone="textSecondary" style={{ padding: spacing.md + 2 }}>
              No payee matches “{query.trim()}”.
            </Text>
          )}
          {shown.map((p, i) => {
            const confirming = confirm === p.id;
            return (
              <View
                key={p.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  paddingHorizontal: spacing.md,
                  paddingVertical: 6,
                  borderBottomWidth: i < shown.length - 1 ? 1 : 0,
                  borderBottomColor: colors.hairline,
                  backgroundColor: confirming ? colors.negativeTint : colors.surface,
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={p.name}
                  accessibilityHint="Long-press to delete"
                  accessibilityActions={[{ name: 'delete', label: 'Delete payee' }]}
                  onAccessibilityAction={(e) => e.nativeEvent.actionName === 'delete' && setConfirm(p.id)}
                  onLongPress={() => {
                    haptic('warning');
                    setConfirm(p.id);
                  }}
                  onPress={() => setConfirm(null)}
                  style={{ flex: 1, minHeight: 30, justifyContent: 'center' }}
                >
                  <Text variant="body" weight="500" numberOfLines={1}>
                    {p.name}
                  </Text>
                </Pressable>
                {confirming ? (
                  <View style={{ width: ENVELOPE_COLUMN, flexDirection: 'row', gap: 6, justifyContent: 'flex-end' }}>
                    <Button title="Cancel" size="sm" variant="secondary" onPress={() => setConfirm(null)} />
                    <Button
                      title="Delete"
                      size="sm"
                      variant="destructive"
                      onPress={() => {
                        deletePayee(p.id);
                        setConfirm(null);
                        showToast({ message: `Deleted ${p.name}` });
                      }}
                    />
                  </View>
                ) : (
                  <View style={{ width: ENVELOPE_COLUMN }}>
                    <Dropdown
                      variant="inline"
                      searchable
                      value={p.income ? READY : (p.envelopeId ?? NONE)}
                      options={options}
                      onChange={(v) => (v === READY ? setPayeeIncome(p.id) : setPayeeEnvelope(p.id, v === NONE ? undefined : v))}
                      accessibilityLabel={`${p.name} default: ${options.find((o) => o.value === (p.income ? READY : (p.envelopeId ?? NONE)))?.label ?? 'Ask each time'}`}
                    />
                  </View>
                )}
              </View>
            );
          })}
          {!q && matches.length > PREVIEW && (
            <CardFooterLink
              label={expanded ? 'Show fewer' : `Show all ${matches.length} ›`}
              onPress={() => setExpanded(!expanded)}
            />
          )}
        </>
      )}
    </Card>
  );
}
