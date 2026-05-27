import {Badge as UiBadge, CommandItem} from '@sqlrooms/ui';
import {useMemo, type FC} from 'react';
import {useContextSelectorContext} from './ContextSelectorContext';
import {ContextSelectorItemIcon} from './ContextSelectorItemIcon';
import type {ContextSelectorItem} from './types';
import {defaultTypeLabel} from './utils';

type ContextSelectorItemProps = {
  item: ContextSelectorItem;
  running: boolean;
  onSelect: () => void;
};

export const ContextSelectorItemComponent: FC<ContextSelectorItemProps> = ({
  item,
  running,
  onSelect,
}) => {
  const {renderItem} = useContextSelectorContext();

  const keywords = useMemo(
    () =>
      [
        item.title,
        item.kind,
        item.type,
        item.subtitle,
        ...(item.keywords ?? []),
      ].filter(Boolean) as string[],
    [item],
  );

  return (
    <CommandItem
      key={item.id}
      value={item.id}
      keywords={keywords}
      disabled={item.disabled}
      onSelect={onSelect}
      className="flex items-center gap-2 text-xs"
    >
      {renderItem ? (
        renderItem({item, selected: false, main: false, running})
      ) : (
        <>
          <span className="shrink-0">
            <ContextSelectorItemIcon item={item} className="h-3.5 w-3.5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate">{item.title}</span>
            {item.subtitle ? (
              <span className="text-muted-foreground block truncate text-xs">
                {item.subtitle}
              </span>
            ) : null}
          </span>
          <span className="text-muted-foreground text-xs capitalize">
            {defaultTypeLabel(item)}
          </span>
          {running ? (
            <UiBadge variant="secondary" className="h-5 px-1.5 text-[10px]">
              Running
            </UiBadge>
          ) : null}
        </>
      )}
    </CommandItem>
  );
};
