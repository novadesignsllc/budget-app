/** Asks before something that can't be undone. Resolves true for yes. */
export function confirmAction(title: string, message: string, _yes: string): Promise<boolean> {
  return Promise.resolve(window.confirm(`${title}\n\n${message}`));
}
