import {useCallback, useState} from 'react';

/**
 * Options for the shared combobox state hook.
 */
export interface UseComboboxOptions<T extends string = string> {
  value: T;
  onChange: (value: T) => void;
  /**
   * Prevent opening the popover and committing selections.
   */
  disabled?: boolean;
}

/**
 * State and prop helpers returned by useCombobox.
 */
export interface UseComboboxReturn {
  open: boolean;
  setOpen: (open: boolean) => void;
  handleSelect: (value: string) => void;
  popoverProps: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
  };
  triggerProps: {
    role: 'combobox';
    'aria-expanded': boolean;
  };
}

/**
 * Shared combobox state and behavior for Popover-based selectors.
 * Handles open/close state and selection with auto-close.
 */
export function useCombobox<T extends string = string>(
  options: UseComboboxOptions<T>,
): UseComboboxReturn {
  const {disabled = false, onChange} = options;
  const [open, setOpen] = useState(false);
  const effectiveOpen = disabled ? false : open;

  const handleSelect = useCallback(
    (value: string) => {
      if (disabled) return;

      onChange(value as T);
      setOpen(false);
    },
    [disabled, onChange],
  );

  return {
    open: effectiveOpen,
    setOpen,
    handleSelect,
    popoverProps: {
      open: effectiveOpen,
      onOpenChange: disabled ? () => {} : setOpen,
    },
    triggerProps: {
      role: 'combobox' as const,
      'aria-expanded': effectiveOpen,
    },
  };
}
