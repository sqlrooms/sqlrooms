import {useMemo} from 'react';
import type {ResolvedColorLegend} from '../config';
import {rgba} from './utils';

const MAX_VISIBLE_ITEMS = 15;
const MAX_TOTAL_ITEMS = 50;

export function CategoricalLegend({
  legend,
  columns,
}: {
  legend: Extract<ResolvedColorLegend, {type: 'categorical'}>;
  columns: number;
}) {
  const {visibleItems, hasMore, totalCount} = useMemo(() => {
    const items = legend.items;
    const truncated = items.slice(0, MAX_TOTAL_ITEMS);
    return {
      visibleItems: truncated,
      hasMore: items.length > MAX_TOTAL_ITEMS,
      totalCount: items.length,
    };
  }, [legend.items]);

  return (
    <div className="flex flex-col">
      <div
        className="[&::-webkit-scrollbar-thumb]:bg-border overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent"
        style={{maxHeight: `${MAX_VISIBLE_ITEMS * 22}px`}}
      >
        <div
          className="grid gap-x-3 gap-y-1.5"
          style={{gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`}}
        >
          {visibleItems.map((item) => (
            <div
              key={`${legend.title}-${item.label}`}
              className="text-foreground flex min-w-0 items-center gap-2 text-xs leading-tight"
              title={item.label}
            >
              <span
                aria-hidden="true"
                className="border-border/70 h-3 w-3 shrink-0 rounded-[2px] border"
                style={{backgroundColor: rgba(item.color)}}
              />
              <span className="truncate">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
      {hasMore && (
        <div className="text-muted-foreground mt-1 text-[10px] leading-tight">
          &hellip; and {totalCount - MAX_TOTAL_ITEMS} more
        </div>
      )}
    </div>
  );
}
