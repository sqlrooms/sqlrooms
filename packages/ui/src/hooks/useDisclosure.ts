import {useState, useCallback} from 'react';

export interface UseDisclosureReturnValue {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onToggle: () => void;
}

/**
 * A custom hook for managing disclosure state (open/closed).
 *
 * @param initialState - The initial state of the disclosure (default: false)
 * @returns An object containing the disclosure state and methods to control it
 *
 * @example
 * ```tsx
 * import { useDisclosure } from '@your-package/ui';
 *
 * function Modal() {
 *   const { isOpen, onOpen, onClose, onToggle } = useDisclosure();
 *
 *   return (
 *     <>
 *       <button onClick={onOpen}>Open Modal</button>
 *
 *       {isOpen && (
 *         <div className="modal">
 *           <div className="modal-content">
 *             <h2>Modal Title</h2>
 *             <p>Modal content goes here...</p>
 *             <button onClick={onClose}>Close</button>
 *           </div>
 *         </div>
 *       )}
 *     </>
 *   );
 * }
 * ```
 */
export function useDisclosure(initialState = false): UseDisclosureReturnValue {
  const [isOpen, setIsOpen] = useState(initialState);

  const onOpen = useCallback(() => {
    setIsOpen(true);
  }, []);

  const onClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const onToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  return {isOpen, onOpen, onClose, onToggle};
}
