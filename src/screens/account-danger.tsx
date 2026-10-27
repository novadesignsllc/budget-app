import { useState } from 'react';

import { backend } from '@/backend';
import { authErrorMessage } from '@/backend/types';
import { Button } from '@/components/button';
import { FormCard, InputRow } from '@/components/form';
import { SheetScreen } from '@/components/screen';
import { SheetHeader } from '@/components/sheet-header';
import { Text } from '@/components/text';
import { useToast } from '@/components/toast';
import { resetStore, useStore } from '@/store';
import { COLLECTIONS } from '@/sync/engine';
import { readScopeOnce, scopeFor, useProfiles } from '@/sync/profiles';
import { pauseSync, resumeSync, useSession } from '@/sync/session';
import { closeSheet } from '@/utils/close-sheet';
import { haptic } from '@/utils/haptics';

/** A field where you type the word in capitals before the red button turns on. */
function ConfirmWord({ word, value, onChange }: { word: string; value: string; onChange: (v: string) => void }) {
  return (
    <FormCard>
      <InputRow
        label={`Type ${word}`}
        value={value}
        onChangeText={onChange}
        placeholder={word}
        autoCapitalize="characters"
        autoCorrect={false}
        autoFocus
        returnKeyType="done"
      />
    </FormCard>
  );
}

/** Erases the whole budget and starts over empty. You stay signed in. */
export function ResetAccount() {
  const showToast = useToast((s) => s.show);
  const [typed, setTyped] = useState('');
  const profiles = useProfiles((s) => s.list);
  const open = useProfiles((s) => s.list.find((p) => p.id === s.activeId));
  // With more than one profile, Reset only clears the one you're in.
  const several = profiles.length > 1 && !!open;
  const ready = typed.trim().toUpperCase() === 'RESET';
  return (
    <SheetScreen>
      <SheetHeader title={several ? `Reset ${open!.name}` : 'Reset account'} />
      <Text variant="callout" tone="textSecondary">
        {several
          ? `This erases every account, envelope, transaction, bill and setting in ${open!.name}, and starts it over empty. Your other profiles aren’t touched. This can’t be undone.`
          : 'This erases every account, envelope, transaction, bill and setting, and starts you over with an empty budget. You stay signed in. This can’t be undone.'}
      </Text>
      <ConfirmWord word="RESET" value={typed} onChange={setTyped} />
      <Button
        title="Reset account"
        variant="destructive"
        size="lg"
        disabled={!ready}
        onPress={() => {
          // Sync sees everything gone and deletes it from Firebase too.
          resetStore();
          haptic('success');
          showToast({ message: several ? `${open!.name} is reset.` : 'Your account is reset.' });
          closeSheet();
        }}
      />
    </SheetScreen>
  );
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (v) => (clearTimeout(t), resolve(v)),
      (e) => (clearTimeout(t), reject(e)),
    );
  });
}

/**
 * Deletes the account for good: proves it's you (password, or Apple again), deletes every
 * doc from Firebase, then deletes the sign-in. If any step fails, nothing after it runs.
 */
export function DeleteAccount() {
  const user = useSession((s) => s.user);
  const method = backend.signInMethod();
  const [typed, setTyped] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ready = typed.trim().toUpperCase() === 'DELETE' && (method !== 'password' || password.length > 0) && !busy;

  async function remove() {
    if (!user) return;
    setBusy(true);
    setError('');
    try {
      await backend.reauthenticate(method === 'password' ? password : undefined);
    } catch (e) {
      setError(authErrorMessage(e));
      setBusy(false);
      return;
    }
    const state = useStore.getState();
    const { list, activeId } = useProfiles.getState();
    // Nothing may write the data back between deleting it and deleting the sign-in.
    pauseSync();
    try {
      // Every profile goes: the one that's open from what's on screen, the others read from Firebase.
      for (const profile of list) {
        const scope = scopeFor(user.uid, profile.id);
        const ops =
          profile.id === activeId
            ? COLLECTIONS.flatMap((name) =>
                (state[name] as { id: string }[]).map((d) => ({ collection: name, id: d.id, data: null })),
              )
            : (await readScopeOnce(scope, COLLECTIONS)).flatMap((c) =>
                c.ids.map((id) => ({ collection: c.collection, id, data: null })),
              );
        await withTimeout(backend.commit(scope, [...ops, { collection: 'meta', id: 'state', data: null }]), 20000);
      }
      // Then the profile list itself.
      await withTimeout(
        backend.commit(
          user.uid,
          list.map((p) => ({ collection: 'profiles', id: p.id, data: null })),
        ),
        20000,
      );
    } catch {
      setError('Deleting needs a connection. Try again when you’re online.');
      resumeSync();
      setBusy(false);
      return;
    }
    try {
      await backend.deleteSignIn();
      haptic('success');
      // Signing out happens on its own: the app goes back to the sign-in screen.
    } catch (e) {
      setError(authErrorMessage(e));
      resumeSync();
      setBusy(false);
    }
  }

  return (
    <SheetScreen>
      <SheetHeader title="Delete account" />
      <Text variant="callout" tone="textSecondary">
        This deletes your account and everything in it from our servers, in every profile: accounts, envelopes,
        transactions, bills and settings. You’ll be signed out. This can’t be undone.
      </Text>
      <ConfirmWord word="DELETE" value={typed} onChange={setTyped} />
      {method === 'password' && (
        <FormCard>
          <InputRow
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
          />
        </FormCard>
      )}
      {error ? (
        <Text variant="callout" tone="negative" align="center">
          {error}
        </Text>
      ) : null}
      <Button
        title={busy ? 'Deleting…' : method === 'apple' ? 'Confirm with Apple and delete' : 'Delete account'}
        variant="destructive"
        size="lg"
        disabled={!ready}
        onPress={() => void remove()}
      />
    </SheetScreen>
  );
}
