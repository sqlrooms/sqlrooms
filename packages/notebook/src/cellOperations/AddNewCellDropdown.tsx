import {
  Command,
  CommandList,
  CommandItem,
  CommandGroup,
  PopoverContent,
  Popover,
  PopoverTrigger,
} from '@sqlrooms/ui';
import {FC, useEffect, useState} from 'react';

import {useStoreWithNotebook} from '../useStoreWithNotebook';
import {NotebookCellTypes} from '../cellSchemas';
import {TriggerButton} from './AddNewCellTrigger';
import {getCellTypeLabel} from '../NotebookUtils';

type Props = {
  onAdd: (type: NotebookCellTypes) => void;
  enableShortcut?: boolean;
  triggerComponent?: React.ReactNode;
};

export const AddNewCellDropdown: FC<Props> = ({
  onAdd,
  enableShortcut = false,
  triggerComponent = <TriggerButton />,
}) => {
  const currentTabId = useStoreWithNotebook(
    (s) => s.notebook.config.currentTabId,
  );
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!currentTabId || !enableShortcut) {
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'j' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{triggerComponent}</PopoverTrigger>

      <AddNewCellDropdownContent
        onAddCell={onAdd}
        currentTabId={currentTabId}
        setOpen={setOpen}
      />
    </Popover>
  );
};

type ContentProps = {
  onAddCell: (type: NotebookCellTypes) => void;
  currentTabId?: string | null;
  align?: 'center' | 'start' | 'end';
  setOpen?: (open: boolean) => void;
};

export const AddNewCellDropdownContent: FC<ContentProps> = ({
  onAddCell,
  currentTabId,
  align = 'center',
  setOpen,
}) => {
  return (
    <PopoverContent
      align={align}
      className="w-[100px] p-0"
      onCloseAutoFocus={(e) => e.preventDefault()}
    >
      <Command tabIndex={0} loop className="focus-visible:outline-none">
        <CommandList className="focus-visible:outline-none">
          <CommandGroup className="[&_[cmdk-group-heading]]:text-foreground p-1 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-sm [&_[cmdk-group-heading]]:font-semibold">
            {NotebookCellTypes.options.map((type: NotebookCellTypes) => {
              return (
                <CommandItem
                  key={type}
                  disabled={!currentTabId}
                  onSelect={() => {
                    onAddCell(type);
                    setOpen?.(false);
                  }}
                  className="cursor-pointer"
                >
                  <span className="text-xs capitalize">
                    {getCellTypeLabel(type)}
                  </span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  );
};
