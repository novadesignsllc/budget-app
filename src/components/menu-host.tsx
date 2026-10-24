import { createContext, use, useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

type Host = {
  /** Shows `node` over the sheet under `key`, or removes it with null. */
  set: (key: string, node: React.ReactNode | null) => void;
  ref: React.RefObject<React.ComponentRef<typeof View> | null>;
};

const MenuHostContext = createContext<Host | null>(null);

/** The sheet's menu layer, or null outside a sheet (menus use a Modal there). */
export function useMenuHost() {
  return use(MenuHostContext);
}

/**
 * A layer over a sheet's content where dropdown menus open. A Modal would take the
 * keyboard away on iPhone; drawing the menu inside the sheet keeps it up.
 */
export function MenuHost({ children }: { children: React.ReactNode }) {
  const ref = useRef<React.ComponentRef<typeof View>>(null);
  const [layers, setLayers] = useState<Record<string, React.ReactNode>>({});
  const set = useCallback((key: string, node: React.ReactNode | null) => {
    setLayers((current) => {
      if (node == null) {
        if (!(key in current)) return current;
        const next = { ...current };
        delete next[key];
        return next;
      }
      return { ...current, [key]: node };
    });
  }, []);
  const host = useMemo(() => ({ set, ref }), [set]);
  return (
    <MenuHostContext value={host}>
      <View ref={ref} collapsable={false} style={{ flex: 1 }}>
        {children}
        {Object.entries(layers).map(([key, node]) => (
          <View key={key} style={StyleSheet.absoluteFill} pointerEvents="box-none">
            {node}
          </View>
        ))}
      </View>
    </MenuHostContext>
  );
}
