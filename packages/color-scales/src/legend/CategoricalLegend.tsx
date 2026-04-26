import type {ResolvedColorLegend} from '../config';
import {rgba} from './utils';

export function CategoricalLegend({
  legend,
  columns,
}: {
  legend: Extract<ResolvedColorLegend, {type: 'categorical'}>;
  columns: number;
}) {
  return (
    <div
      className="grid gap-x-3 gap-y-1.5"
      style={{gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`}}
    >
      {legend.items.map((item) => (
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
  );
}
