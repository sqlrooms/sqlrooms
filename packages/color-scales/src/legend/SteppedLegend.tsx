import {useMemo} from 'react';
import type {ResolvedColorLegend} from '../config';
import {LegendTicks} from './LegendTicks';
import {getRampStyle, LEGEND_TICKS_HEIGHT_CLASS, rgba} from './utils';

const MAX_VISIBLE_ITEMS = 15;
const MAX_TOTAL_ITEMS = 50;

export function SteppedLegend({
  legend,
  width,
}: {
  legend: Extract<ResolvedColorLegend, {type: 'stepped'}>;
  width: number;
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
    <div className="min-w-0" style={getRampStyle(width)}>
      <div className="border-border/70 flex h-3 overflow-hidden rounded-[2px] border">
        {visibleItems.map((item) => (
          <span
            key={`${legend.title}-${item.label}`}
            aria-label={item.label}
            className="border-background/70 min-w-0 flex-1 border-r last:border-r-0"
            style={{backgroundColor: rgba(item.color)}}
            title={item.label}
          />
        ))}
      </div>
      {legend.ticks?.length ? (
        <LegendTicks ticks={legend.ticks} width={width} />
      ) : (
        <div className={LEGEND_TICKS_HEIGHT_CLASS} />
      )}
      <div
        className="[&::-webkit-scrollbar-thumb]:bg-border mt-1 grid gap-1 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent"
        style={{maxHeight: `${MAX_VISIBLE_ITEMS * 18}px`}}
      >
        {visibleItems.map((item) => (
          <div
            key={`${legend.title}-${item.label}-range`}
            className="text-muted-foreground truncate text-[10px] leading-tight"
            title={item.label}
          >
            {item.label}
          </div>
        ))}
      </div>
      {hasMore && (
        <div className="text-muted-foreground mt-1 text-[10px] leading-tight">
          &hellip; and {totalCount - MAX_TOTAL_ITEMS} more
        </div>
      )}
    </div>
  );
}
