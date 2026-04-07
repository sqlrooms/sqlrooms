import {useCallback, useEffect, useState} from 'react';
import {useDebouncedCallback} from './useDebouncedCallback';

/**
 * Hook for managing local state with debounced persistence.
 *
 * Provides immediate local state updates for responsive UI while
 * debouncing expensive persistence operations (e.g., store updates, API calls).
 *
 * @param externalValue - Value from external source (store, props, etc.)
 * @param onPersist - Callback to persist value (will be debounced)
 * @param debounceMs - Debounce delay in milliseconds (default: 300)
 *
 * @returns [localValue, setValue] - Current local value and setter function
 *
 * @example
 * ```tsx
 * const [localSpec, setSpec] = useDebouncedValue(
 *   cell.data.vegaSpec,
 *   (spec) => updateCell(id, draft => { draft.data.vegaSpec = spec }),
 *   300
 * );
 * ```
 */
export function useDebouncedValue<T>(
  externalValue: T,
  onPersist: (value: T) => void,
  debounceMs = 300,
): [T, (value: T) => void] {
  // Local state for immediate UI updates
  const [localValue, setLocalValue] = useState<T>(externalValue);

  // Sync local state when external value changes
  useEffect(() => {
    setLocalValue(externalValue);
  }, [externalValue]);

  // Debounced persistence
  const debouncedPersist = useDebouncedCallback(onPersist, debounceMs);

  // Combined setter: immediate local update + debounced persist
  const setValue = useCallback(
    (value: T) => {
      setLocalValue(value);
      debouncedPersist(value);
    },
    [debouncedPersist],
  );

  return [localValue, setValue];
}
