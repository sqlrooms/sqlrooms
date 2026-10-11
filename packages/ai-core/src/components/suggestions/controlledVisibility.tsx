import {createContext, useContext, useMemo, type ReactNode} from 'react';

/** A host-owned visibility state, published by a controlled `Root`. */
export type ControlledVisibility = {
  visible: boolean;
  setVisible: (visible: boolean) => void;
};

const ControlledVisibilityContext = createContext<ControlledVisibility | null>(
  null,
);

/**
 * Publishes a controlled `Root`'s `open`/`onOpenChange` to `Dismiss` and
 * `VisibilityToggle` beneath it, so they write the host's state rather than the
 * overridden store. Controls *outside* a controlled root see no override and
 * keep targeting the store.
 */
export function ControlledVisibilityProvider({
  open,
  onOpenChange,
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}) {
  const value = useMemo<ControlledVisibility | null>(
    () =>
      open === undefined
        ? null
        : {visible: open, setVisible: (next) => onOpenChange?.(next)},
    [open, onOpenChange],
  );

  if (!value) return <>{children}</>;
  return (
    <ControlledVisibilityContext.Provider value={value}>
      {children}
    </ControlledVisibilityContext.Provider>
  );
}

/**
 * The nearest controlled visibility state, or `null` when visibility is owned
 * by the normalized store.
 */
export function useControlledVisibility(): ControlledVisibility | null {
  return useContext(ControlledVisibilityContext);
}
