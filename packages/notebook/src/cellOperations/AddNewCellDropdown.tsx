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
import {TriggerButton} from './AddNewCellTrigger';
import {getCellTypeLabel} from '../NotebookUtils';

type Props = {
  artifactId: string;
  onAdd: (type: string) => void;
  enableShortcut?: boolean;
  triggerComponent?: React.ReactNode;
};

export const AddNewCellDropdown: FC<Props> = ({
  artifactId,
  onAdd,
  enableShortcut = false,
  triggerComponent = <TriggerButton />,
}) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!artifactId || !enableShortcut) {
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
        artifactId={artifactId}
        setOpen={setOpen}
      />
    </Popover>
  );
};

type ContentProps = {
  onAddCell: (type: string) => void;
  artifactId?: string | null;
  align?: 'center' | 'start' | 'end';
  setOpen?: (open: boolean) => void;
};

export const AddNewCellDropdownContent: FC<ContentProps> = ({
  onAddCell,
  artifactId,
  align = 'center',
  setOpen,
}) => {
  const cellRegistry = useStoreWithNotebook((s) => s.cells.cellRegistry);
  const availableTypes = Object.keys(cellRegistry);

  return (
    <PopoverContent
      align={align}
      className="w-auto p-0"
      onCloseAutoFocus={(e) => e.preventDefault()}
    >
      <Command tabIndex={0} loop className="focus-visible:outline-none">
        <CommandList className="focus-visible:outline-none">
          <CommandGroup className="**:[[cmdk-group-heading]]:text-foreground p-1 **:[[cmdk-group-heading]]:py-1.5 **:[[cmdk-group-heading]]:text-sm **:[[cmdk-group-heading]]:font-semibold">
            {availableTypes.map((type: string) => {
              return (
                <CommandItem
                  key={type}
                  disabled={!artifactId}
                  onSelect={() => {
                    onAddCell(type);
                    setOpen?.(false);
                  }}
                  className="cursor-pointer"
                >
                  <span className="text-xs whitespace-nowrap capitalize">
                    {getCellTypeLabel(type, cellRegistry)}
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
