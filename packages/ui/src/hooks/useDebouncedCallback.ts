import {useCallback, useEffect, useRef} from 'react';

/**
 * A custom hook for debouncing function calls.
 *
 * @param callback - The function to debounce
 * @param delay - The delay in milliseconds (default: 300)
 * @returns The debounced callback function
 *
 * @example
 * ```tsx
 * import { useDebouncedCallback } from '@sqlrooms/ui';
 *
 * function AutoSaveForm() {
 *   const [formData, setFormData] = useState({ name: '', email: '' });
 *
 *   const debouncedSave = useDebouncedCallback(
 *     (data: typeof formData) => {
 *       // This will only run 300ms after the user stops typing
 *       saveToServer(data);
 *     },
 *     300
 *   );
 *
 *   const handleChange = (field: string, value: string) => {
 *     const newData = { ...formData, [field]: value };
 *     setFormData(newData);
 *     debouncedSave(newData);
 *   };
 *
 *   return (
 *     <form>
 *       <input
 *         value={formData.name}
 *         onChange={(e) => handleChange('name', e.target.value)}
 *       />
 *       <input
 *         value={formData.email}
 *         onChange={(e) => handleChange('email', e.target.value)}
 *       />
 *     </form>
 *   );
 * }
 * ```
 */
export function useDebouncedCallback<T extends (...args: any[]) => void>(
  callback: T,
  delay = 300,
): T {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);

  // Keep callback ref up to date
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay],
  ) as T;
}
