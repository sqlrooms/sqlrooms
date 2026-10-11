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
  align = 'start',
  side = 'top',
  avoidCollisions = false,
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

  // Group by kind automatically
  const groupedItems = useMemo(() => {
    const groups: Record<string, ContextSelectorItem[]> = {};
    for (const item of items) {
      const groupKey = item.kind;
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(item);
    }
    return groups;
  }, [items]);

  const hasMultipleKinds = Object.keys(groupedItems).length > 1;

  return (
    <PopoverContent
      align={align}
      side={side}
      avoidCollisions={avoidCollisions}
      className={cn('w-72 p-0', className)}
    >
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
                        selected={selectedIdSet.has(item.id)}
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
              {items.map((item) => (
                <ContextSelectorItemComponent
                  key={item.id}
                  item={item}
                  selected={selectedIdSet.has(item.id)}
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
