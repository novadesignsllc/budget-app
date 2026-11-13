import { createPlaidLinkSession } from 'react-native-plaid-link-sdk';

/** Opens Plaid's bank sign-in. Resolves with the public token, or null if they backed out. */
export async function openPlaidLink(linkToken: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    createPlaidLinkSession({
      token: linkToken,
      onSuccess: (success) => resolve(success.publicToken),
      onExit: () => resolve(null),
      onEvent: () => {},
    })
      .then((session) => session.open(false))
      .catch(reject);
  });
}
