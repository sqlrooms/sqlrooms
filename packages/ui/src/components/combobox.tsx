'use client';

import {
  type FC,
  type PropsWithChildren,
  createContext,
  useContext,
} from 'react';
import {Check, ChevronsUpDown} from 'lucide-react';
import {cn} from '../lib/utils';
import {Button} from './button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './command';
import {Popover, PopoverContent, PopoverTrigger} from './popover';
import {useCombobox, type UseComboboxOptions} from '../hooks/useCombobox';

interface ComboboxContextValue {
  open: boolean;
  currentValue: string;
  handleSelect: (value: string) => void;
}

const ComboboxContext = createContext<ComboboxContextValue | null>(null);

function useComboboxContext() {
  const context = useContext(ComboboxContext);
  if (!context) {
    throw new Error(
      'Combobox compound components must be used within Combobox',
    );
  }
  return context;
}

/**
 * Root props for the compound Combobox component.
 */
export type ComboboxRootProps<T extends string = string> = PropsWithChildren<
  UseComboboxOptions<T> & {
    /**
     * Optional selected value used for item highlighting when it differs from
     * the controlled value.
     */
    currentValue?: string;
  }
>;

function ComboboxRoot<T extends string = string>({
  value,
  onChange,
  currentValue,
  children,
}: ComboboxRootProps<T>) {
  const {popoverProps, handleSelect, open} = useCombobox({value, onChange});

  return (
    <ComboboxContext.Provider
      value={{
        open,
        currentValue: currentValue ?? String(value),
        handleSelect,
      }}
    >
      <Popover {...popoverProps}>{children}</Popover>
    </ComboboxContext.Provider>
  );
}

/**
 * Props for the button that opens the combobox popover.
 */
export interface ComboboxTriggerProps {
  className?: string;
  ariaLabel?: string;
}

const ComboboxTrigger: FC<PropsWithChildren<ComboboxTriggerProps>> = ({
  children,
  className,
  ariaLabel,
}) => {
  const {open} = useComboboxContext();

  return (
    <PopoverTrigger asChild>
      <Button
        variant="outline"
        role="combobox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={cn('h-8 justify-between text-xs font-normal', className)}
      >
        {children}
        <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
      </Button>
    </PopoverTrigger>
  );
};

/**
 * Props for the popover content that contains combobox options.
 */
export interface ComboboxContentProps {
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
}

const ComboboxContent: FC<PropsWithChildren<ComboboxContentProps>> = ({
  children,
  searchable = false,
  searchPlaceholder = 'Search...',
  emptyMessage = 'No matching option.',
}) => {
  return (
    <PopoverContent className="w-[--radix-popover-trigger-width] p-0 text-xs">
      <Command>
        {searchable && (
          <CommandInput placeholder={searchPlaceholder} className="text-xs" />
        )}
        <CommandList>
          <CommandEmpty>{emptyMessage}</CommandEmpty>
          <CommandGroup>{children}</CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  );
};

/**
 * Props for an individual selectable combobox item.
 */
export interface ComboboxItemProps {
  /**
   * Stable item value committed through the Combobox onChange handler.
   */
  value: string;
  /**
   * Optional display text or aliases used to match this item during search.
   */
  keywords?: string[];
  isSelected?: boolean;
}

const ComboboxItem: FC<PropsWithChildren<ComboboxItemProps>> = ({
  value,
  keywords,
  children,
  isSelected,
}) => {
  const {currentValue, handleSelect} = useComboboxContext();
  const selected = isSelected ?? currentValue === value;

  return (
    <CommandItem value={value} keywords={keywords} onSelect={handleSelect}>
      <Check
        className={cn(
          'h-3.5 w-3.5 shrink-0',
          selected ? 'opacity-100' : 'opacity-0',
        )}
      />
      {children}
    </CommandItem>
  );
};

/**
 * Compound component for Popover-based combobox selectors.
 *
 * @example
 * ```tsx
 * <Combobox value={value} onChange={setValue}>
 *   <Combobox.Trigger>
 *     <span>{selectedLabel}</span>
 *   </Combobox.Trigger>
 *   <Combobox.Content searchable searchPlaceholder="Search...">
 *     {options.map((option) => (
 *       <Combobox.Item key={option.value} value={option.value}>
 *         <span>{option.label}</span>
 *       </Combobox.Item>
 *     ))}
 *   </Combobox.Content>
 * </Combobox>
 * ```
 */
export const Combobox = Object.assign(ComboboxRoot, {
  Trigger: ComboboxTrigger,
  Content: ComboboxContent,
  Item: ComboboxItem,
});
