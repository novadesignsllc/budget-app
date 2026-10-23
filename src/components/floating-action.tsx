import { useDock } from './dock';
import { ActionButton, ScreenActions } from './screen-actions';

/** Where floating things sit: just above the dock. */
export function useFloatingBottom() {
  return useDock().floatBottom;
}

/** Kept for older screens: a single add action in the action bar. */
export function FloatingAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <ScreenActions>
      <ActionButton icon={{ sf: 'plus', md: 'add' }} label={label} variant="ink" onPress={onPress} />
    </ScreenActions>
  );
}
