import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, View } from 'react-native';

import { backend } from '@/backend';
import { authErrorMessage } from '@/backend/types';
import { AppleSignInButton } from '@/components/apple-sign-in-button';
import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { Text } from '@/components/text';
import { gutter, spacing, useColors } from '@/theme';

type Mode = 'signIn' | 'create';

export function SignIn() {
  const colors = useColors();
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = email.includes('@') && password.length > 0;

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          padding: gutter,
          gap: spacing.xl,
          width: '100%',
          maxWidth: 420,
          alignSelf: 'center',
        }}
      >
        <View style={{ gap: spacing.sm }}>
          <Text variant="largeTitle">Zero Budget</Text>
          <Text variant="body" tone="textSecondary">
            Sign in to keep your budget on your phone and your computer.
          </Text>
        </View>

        {backend.appleSignInAvailable && (
          <View style={{ gap: spacing.lg }}>
            <AppleSignInButton onPress={() => run(backend.signInWithApple)} />
            <Text variant="footnote" tone="textSecondary" align="center">
              or use email
            </Text>
          </View>
        )}

        <View style={{ gap: spacing.md }}>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            inputMode="email"
            textContentType="emailAddress"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
            textContentType={mode === 'create' ? 'newPassword' : 'password'}
            hint={mode === 'create' ? 'At least 6 characters.' : undefined}
            onSubmitEditing={() =>
              canSubmit &&
              run(() =>
                mode === 'create' ? backend.createAccount(email, password) : backend.signInWithEmail(email, password),
              )
            }
          />
          {error ? (
            <Text variant="callout" tone="negative">
              {error}
            </Text>
          ) : null}
          {notice ? (
            <Text variant="callout" tone="positive">
              {notice}
            </Text>
          ) : null}
          <Button
            title={mode === 'create' ? 'Create account' : 'Sign in'}
            size="lg"
            loading={busy}
            disabled={!canSubmit}
            onPress={() =>
              run(() =>
                mode === 'create' ? backend.createAccount(email, password) : backend.signInWithEmail(email, password),
              )
            }
          />
        </View>

        <View style={{ gap: spacing.xs, alignItems: 'flex-start' }}>
          <Button
            variant="ghost"
            size="sm"
            style={{ paddingHorizontal: spacing.xs }}
            title={mode === 'create' ? 'I already have an account' : 'Create an account'}
            onPress={() => {
              setMode(mode === 'create' ? 'signIn' : 'create');
              setError('');
            }}
          />
          {mode === 'signIn' && (
            <Button
              variant="ghost"
              size="sm"
              style={{ paddingHorizontal: spacing.xs }}
              title="Forgot password"
              onPress={() => {
                if (!email.includes('@')) return setError('Type your email first, then tap Forgot password.');
                void run(async () => {
                  await backend.sendPasswordReset(email);
                  setNotice('Check your email for a link to reset it.');
                });
              }}
            />
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
