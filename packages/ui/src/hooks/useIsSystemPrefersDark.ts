import {useSyncExternalStore} from 'react';

export function useIsSystemPrefersDark(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === 'undefined') {
        return () => {};
      }

      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', onStoreChange);
      return () => mediaQuery.removeEventListener('change', onStoreChange);
    },
    () => {
      if (typeof window === 'undefined') {
        return false;
      }

      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    },
    () => false,
  );
}
