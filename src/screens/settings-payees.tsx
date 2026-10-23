import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/button';
import { Row, Section } from '@/components/list';
import { Select } from '@/components/select';
import { Text } from '@/components/text';
import { useStore } from '@/store';
import { spacing } from '@/theme';

const NONE = '__none__';

/** Payees and the envelope each one defaults to. Quick-add uses these first. */
export function PayeesSection() {
  const payees = useStore((s) => s.payees);
  const envelopes = useStore((s) => s.envelopes);
  const setPayeeEnvelope = useStore((s) => s.setPayeeEnvelope);
  const deletePayee = useStore((s) => s.deletePayee);
  const [open, setOpen] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  const spendable = envelopes.filter((e) => !e.hidden && !e.debtAccountId);
  const nameOf = (id?: string) => envelopes.find((e) => e.id === id)?.name;
  const sorted = [...payees].sort((a, b) => a.name.localeCompare(b.name));
  const options = [{ value: NONE, label: 'No default' }, ...spendable.map((e) => ({ value: e.id, label: e.name }))];

  return (
    <Section title="Payees" footer="Quick-add puts a payee’s transactions in its default envelope.">
      {sorted.length === 0 ? (
        <View style={{ padding: spacing.lg }}>
          <Text variant="callout" tone="textSecondary">
            Payees show up here as you add transactions.
          </Text>
        </View>
      ) : (
        sorted.map((p) =>
          open === p.id ? (
            <View key={p.id} style={{ padding: spacing.lg - 2, gap: spacing.md }}>
              <Text variant="body" weight="600">
                {p.name}
              </Text>
              <Select
                label="Default envelope"
                value={p.envelopeId ?? NONE}
                options={options}
                onChange={(v) => setPayeeEnvelope(p.id, v === NONE ? undefined : v)}
              />
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button title="Done" size="sm" variant="secondary" onPress={() => setOpen(null)} />
                <Button
                  title={confirm === p.id ? 'Tap again to delete' : 'Delete payee'}
                  size="sm"
                  variant="destructive"
                  onPress={() => {
                    if (confirm !== p.id) return setConfirm(p.id);
                    deletePayee(p.id);
                    setOpen(null);
                    setConfirm(null);
                  }}
                />
              </View>
            </View>
          ) : (
            <Row
              key={p.id}
              title={p.name}
              subtitle={nameOf(p.envelopeId) ?? 'No default envelope'}
              onPress={() => {
                setOpen(p.id);
                setConfirm(null);
              }}
              chevron
            />
          ),
        )
      )}
    </Section>
  );
}
