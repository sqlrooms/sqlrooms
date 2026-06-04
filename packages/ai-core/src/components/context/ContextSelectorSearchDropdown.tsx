import {
  cn,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandList,
  PopoverContent,
} from '@sqlrooms/ui';
import type {FC} from 'react';
import {useMemo} from 'react';
import {useContextSelectorContext} from './ContextSelectorContext';
import {ContextSelectorItemComponent} from './ContextSelectorItem';
import type {
  ContextSelectorItem,
  ContextSelectorSearchDropdownProps,
} from './types';
import {getGroupLabel} from './utils';

export const ContextSelectorSearchDropdown: FC<
  ContextSelectorSearchDropdownProps
> = ({
  className,
  align = 'end',
  searchPlaceholder = 'Search context...',
  emptyLabel = 'No context item found.',
}) => {
  const {items, selectedIds, runningContextIds, setOpen, toggleItem} =
    useContextSelectorContext();

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const runningIdSet = useMemo(
    () => new Set(runningContextIds ?? []),
    [runningContextIds],
  );

  const availableItems = useMemo(
    () => items.filter((item) => !selectedIdSet.has(item.id)),
    [items, selectedIdSet],
  );

  // Group by kind automatically
  const groupedItems = useMemo(() => {
    const groups: Record<string, ContextSelectorItem[]> = {};
    for (const item of availableItems) {
      const groupKey = item.kind;
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(item);
    }
    return groups;
  }, [availableItems]);

  const hasMultipleKinds = Object.keys(groupedItems).length > 1;

  return (
    <PopoverContent align={align} className={cn('w-72 p-0', className)}>
      <Command>
        <CommandInput placeholder={searchPlaceholder} />
        <CommandList>
          <CommandEmpty>{emptyLabel}</CommandEmpty>
          {hasMultipleKinds ? (
            <>
              {Object.entries(groupedItems).map(([groupKey, groupItems]) =>
                groupItems.length > 0 ? (
                  <CommandGroup
                    key={groupKey}
                    heading={getGroupLabel(groupKey)}
                  >
                    {groupItems.map((item) => (
                      <ContextSelectorItemComponent
                        key={item.id}
                        item={item}
                        running={runningIdSet.has(item.id)}
                        onSelect={() => {
                          toggleItem(item.id);
                          setOpen(false);
                        }}
                      />
                    ))}
                  </CommandGroup>
                ) : null,
              )}
            </>
          ) : (
            <CommandGroup>
              {availableItems.map((item) => (
                <ContextSelectorItemComponent
                  key={item.id}
                  item={item}
                  running={runningIdSet.has(item.id)}
                  onSelect={() => {
                    toggleItem(item.id);
                    setOpen(false);
                  }}
                />
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </PopoverContent>
  );
};
