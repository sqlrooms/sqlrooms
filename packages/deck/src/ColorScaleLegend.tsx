import {cn} from '@sqlrooms/ui';
import type {SqlroomsResolvedColorLegend} from './json/compileSqlroomsColorScale';

type ColorScaleLegendProps = {
  legends: SqlroomsResolvedColorLegend[];
  className?: string;
};

export function ColorScaleLegend({legends, className}: ColorScaleLegendProps) {
  if (!legends.length) {
    return null;
  }

  return (
    <div
      className={cn(
        'pointer-events-none absolute right-4 bottom-4 z-10 flex max-w-56 flex-col gap-3',
        className,
      )}
    >
      {legends.map((legend) => (
        <div
          key={`${legend.title}-${legend.type}`}
          className="rounded-md border border-black/10 bg-white/92 p-3 shadow-sm backdrop-blur-sm"
        >
          <div className="mb-2 text-xs font-semibold text-slate-800">
            {legend.title}
          </div>
          {legend.type === 'continuous' ? (
            <div>
              <div
                className="h-3 rounded-sm border border-black/10"
                style={{background: legend.gradient}}
              />
              <div className="mt-1 flex justify-between gap-2 text-[11px] text-slate-600">
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
                  className="flex items-center gap-2 text-[11px] text-slate-700"
                >
                  <span
                    className="h-3 w-3 rounded-sm border border-black/10"
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
