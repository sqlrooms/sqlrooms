import {cn} from '@sqlrooms/ui';
import type {ResolvedColorLegend} from './config';

type ColorScaleLegendProps = {
  legends: ResolvedColorLegend[];
  className?: string;
};

/** TODO: implement nicer legends like in https://observablehq.com/@d3/color-legend */
export function ColorScaleLegend({legends, className}: ColorScaleLegendProps) {
  if (!legends.length) {
    return null;
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {legends.map((legend) => (
        <div
          key={`${legend.title}-${legend.type}`}
          className="bg-background/70 rounded-md px-3 py-2 shadow-sm backdrop-blur-sm"
        >
          <div className="text-foreground mb-2 text-xs font-semibold">
            {legend.title}
          </div>
          {legend.type === 'continuous' ? (
            <div>
              <div
                className="h-3 rounded-sm border"
                style={{background: legend.gradient}}
              />
              <div className="text-muted-foreground mt-1 flex justify-between gap-2 text-[0.6rem]">
                {legend.ticks.map((tick) => (
                  <span
                    key={`${legend.title}-${tick.offset}-${tick.label}`}
                    className={cn(
                      tick.offset === 50 ? 'text-center' : '',
                      tick.offset === 100 ? 'text-right' : '',
                    )}
                  >
                    {tick.label}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              {legend.items.map((item) => (
                <div
                  key={`${legend.title}-${item.label}`}
                  className="text-foreground flex items-center gap-2 text-xs"
                >
                  <span
                    className="h-3 w-3 rounded-sm border"
                    style={{
                      backgroundColor: `rgba(${item.color[0]}, ${item.color[1]}, ${item.color[2]}, ${item.color[3] / 255})`,
                    }}
                  />
                  <span className="truncate">{item.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
