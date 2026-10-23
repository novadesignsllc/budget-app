import * as AppleAuthentication from 'expo-apple-authentication';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { radius } from '@/theme';

/** Apple's own button, as its guidelines require. */
export function AppleSignInButton({ onPress }: { onPress: () => void }) {
  const dark = useColorScheme() === 'dark';
  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
      buttonStyle={
        dark
          ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
          : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
      }
      cornerRadius={radius.full}
      style={{ height: 54, width: '100%' }}
      onPress={onPress}
    />
  );
}
