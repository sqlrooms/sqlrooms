import type {ResolvedColorLegend} from '../config';
import {LegendTicks} from './LegendTicks';
import {getRampStyle, rgba} from './utils';

export function SteppedLegend({
  legend,
  width,
}: {
  legend: Extract<ResolvedColorLegend, {type: 'stepped'}>;
  width: number;
}) {
  return (
    <div className="min-w-0" style={getRampStyle(width)}>
      <div className="border-border/70 flex h-3 overflow-hidden rounded-[2px] border">
        {legend.items.map((item) => (
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
        <div className="h-2" />
      )}
      <div className="mt-1 grid gap-1">
        {legend.items.map((item) => (
          <div
            key={`${legend.title}-${item.label}-range`}
            className="text-muted-foreground truncate text-[10px] leading-tight"
            title={item.label}
          >
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}
