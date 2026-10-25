import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, TextInput, View } from 'react-native';

import { backend } from '@/backend';
import { setDemoMode } from '@/backend/mode';
import { authErrorMessage } from '@/backend/types';
import { AppleSignInButton } from '@/components/apple-sign-in-button';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Field } from '@/components/field';
import { Text } from '@/components/text';
import { gutter, spacing, useColors } from '@/theme';

type Mode = 'signIn' | 'create';

function TextLink({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" hitSlop={6} onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      <Text variant="callout" weight="600" tone="accent">
        {title}
      </Text>
    </Pressable>
  );
}

export function SignIn() {
  const colors = useColors();
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const passwordRef = useRef<React.ComponentRef<typeof TextInput>>(null);
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
  const submit = () =>
    canSubmit &&
    run(() => (mode === 'create' ? backend.createAccount(email, password) : backend.signInWithEmail(email, password)));

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          padding: gutter,
          gap: spacing.lg,
          width: '100%',
          maxWidth: 400,
          alignSelf: 'center',
        }}
      >
        <View style={{ gap: 4, alignItems: 'center', paddingBottom: spacing.sm }}>
          <Text variant="number" align="center" accessibilityRole="header">
            Slip
          </Text>
          <Text variant="callout" tone="textSecondary" align="center">
            {mode === 'create'
              ? 'Make an account so your budget syncs to your phone and computer.'
              : 'Sign in to keep your budget on your phone and your computer.'}
          </Text>
        </View>

        <Card padded>
          {backend.appleSignInAvailable && (
            <>
              <AppleSignInButton onPress={() => run(backend.signInWithApple)} />
              <Text variant="footnote" tone="textTertiary" align="center">
                or use email
              </Text>
            </>
          )}
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            inputMode="email"
            textContentType="emailAddress"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
          <Field
            ref={passwordRef}
            returnKeyType="go"
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
            textContentType={mode === 'create' ? 'newPassword' : 'password'}
            hint={mode === 'create' ? 'At least 6 characters.' : undefined}
            onSubmitEditing={submit}
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
            onPress={submit}
          />
        </Card>

        <View style={{ alignItems: 'center', gap: spacing.md, paddingTop: spacing.xs }}>
          <View style={{ flexDirection: 'row', gap: spacing.lg, justifyContent: 'center' }}>
            <TextLink
              title={mode === 'create' ? 'I already have an account' : 'Create an account'}
              onPress={() => {
                setMode(mode === 'create' ? 'signIn' : 'create');
                setError('');
              }}
            />
            {mode === 'signIn' && (
              <TextLink
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
          <TextLink title="Explore the demo" onPress={() => void setDemoMode(true)} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
