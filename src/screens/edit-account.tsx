import { useState } from 'react';

import { Button } from '@/components/button';
import { FormCard, InputRow } from '@/components/form';
import { SheetScreen } from '@/components/screen';
import { SheetHeader } from '@/components/sheet-header';
import { Text } from '@/components/text';
import { useStore } from '@/store';
import { closeSheet } from '@/utils/close-sheet';
import { haptic } from '@/utils/haptics';

/** Renames an account. A debt's payment envelope takes the new name too. */
export function EditAccount({ id }: { id: string }) {
  const account = useStore((s) => s.accounts.find((a) => a.id === id));
  const updateAccount = useStore((s) => s.updateAccount);
  const [name, setName] = useState(account?.name ?? '');

  if (!account) {
    return (
      <SheetScreen>
        <SheetHeader title="Account" />
        <Text variant="callout" tone="textSecondary" align="center">
          This account doesn’t exist anymore.
        </Text>
      </SheetScreen>
    );
  }

  const trimmed = name.trim();
  const save = () => {
    if (!trimmed) return;
    if (trimmed !== account.name) updateAccount(id, { name: trimmed });
    haptic('success');
    closeSheet();
  };

  return (
    <SheetScreen>
      <SheetHeader title="Rename account" />
      <FormCard>
        <InputRow
          label="Name"
          value={name}
          onChangeText={setName}
          autoFocus
          selectTextOnFocus
          autoCapitalize="words"
          returnKeyType="done"
          onSubmitEditing={save}
        />
      </FormCard>
      <Button title="Save" size="lg" disabled={!trimmed} onPress={save} />
    </SheetScreen>
  );
}
