// Copyright 2022 Foursquare Labs, Inc. All Rights Reserved.

import {
  Command,
  CommandList,
  CommandItem,
  CommandGroup,
  PopoverContent,
} from '@sqlrooms/ui';
import {FC} from 'react';

import {NotebookCellTypes} from '../cellSchemas';

type Props = {
  onAddCell: (type: NotebookCellTypes) => void;
  currentTabId?: string | null;
  align?: 'center' | 'start' | 'end';
  setOpen?: (open: boolean) => void;
};

export const AddNewCellDropdownContent: FC<Props> = ({
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
                  <span className="text-xs capitalize">{type}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  );
};
