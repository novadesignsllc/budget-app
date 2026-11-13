/** Plaid's own script, loaded once, on demand. */
const SCRIPT = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';

type PlaidHandler = { open: () => void; destroy: () => void };
type PlaidGlobal = {
  create: (config: {
    token: string;
    onSuccess: (publicToken: string) => void;
    onExit: () => void;
  }) => PlaidHandler;
};

let loading: Promise<PlaidGlobal> | null = null;

function loadPlaid(): Promise<PlaidGlobal> {
  const ready = (window as unknown as { Plaid?: PlaidGlobal }).Plaid;
  if (ready) return Promise.resolve(ready);
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => resolve((window as unknown as { Plaid: PlaidGlobal }).Plaid);
    s.onerror = () => {
      loading = null;
      reject(new Error('Couldn’t load the bank sign-in. Check your connection.'));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/** Opens Plaid's bank sign-in. Resolves with the public token, or null if they backed out. */
export async function openPlaidLink(linkToken: string): Promise<string | null> {
  const Plaid = await loadPlaid();
  return new Promise((resolve) => {
    const handler = Plaid.create({
      token: linkToken,
      onSuccess: (publicToken) => {
        handler.destroy();
        resolve(publicToken);
      },
      onExit: () => {
        handler.destroy();
        resolve(null);
      },
    });
    handler.open();
  });
}
