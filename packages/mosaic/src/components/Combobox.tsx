import {
  type FC,
  type PropsWithChildren,
  createContext,
  useContext,
} from 'react';
import {
  Button,
  cn,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@sqlrooms/ui';
import {Check, ChevronsUpDown} from 'lucide-react';
import {useCombobox, type UseComboboxOptions} from './useCombobox';

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

type ComboboxRootProps<T> = PropsWithChildren<
  UseComboboxOptions<T> & {
    currentValue?: string;
  }
>;

function ComboboxRoot<T = string>({
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

type ComboboxTriggerProps = {
  className?: string;
  ariaLabel?: string;
};

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

type ComboboxContentProps = {
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
};

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

type ComboboxItemProps = {
  value: string;
  isSelected?: boolean;
};

const ComboboxItem: FC<PropsWithChildren<ComboboxItemProps>> = ({
  value,
  children,
  isSelected,
}) => {
  const {currentValue, handleSelect} = useComboboxContext();
  const selected = isSelected ?? currentValue === value;

  return (
    <CommandItem value={value} onSelect={handleSelect}>
      <Check
        className={cn(
          'mr-2 h-3.5 w-3.5 shrink-0',
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
 * Example usage:
 * ```tsx
 * <Combobox value={value} onChange={onChange}>
 *   <Combobox.Trigger>
 *     <span>{selectedLabel}</span>
 *   </Combobox.Trigger>
 *   <Combobox.Content searchable searchPlaceholder="Search...">
 *     {options.map(opt => (
 *       <Combobox.Item key={opt.value} value={opt.value}>
 *         <span>{opt.label}</span>
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
