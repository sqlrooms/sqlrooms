import {useState, useCallback} from 'react';

export interface UseComboboxOptions<T extends string = string> {
  value: T;
  onChange: (value: T) => void;
}

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
  const [open, setOpen] = useState(false);

  const handleSelect = useCallback(
    (value: string) => {
      options.onChange(value as T);
      setOpen(false);
    },
    [options],
  );

  return {
    open,
    setOpen,
    handleSelect,
    popoverProps: {
      open,
      onOpenChange: setOpen,
    },
    triggerProps: {
      role: 'combobox' as const,
      'aria-expanded': open,
    },
  };
}
