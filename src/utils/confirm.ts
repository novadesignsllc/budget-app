import { useConfirm } from '@/components/confirm-dialog';

/** Asks before something that can't be undone, in the app's own dialog. Resolves true for yes. */
export function confirmAction(title: string, message: string, yes: string, destructive = false): Promise<boolean> {
  // A new question cancels one still open, so its caller never hangs.
  useConfirm.getState().ask?.resolve(false);
  return new Promise((resolve) => useConfirm.setState({ ask: { title, message, yes, destructive, resolve } }));
}
