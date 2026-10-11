import {useState} from 'react';
import {cn} from '@sqlrooms/ui';
import type {ResolvedColorLegend} from './config';
import {CategoricalLegend} from './legend/CategoricalLegend';
import {ContinuousLegend} from './legend/ContinuousLegend';
import {SteppedLegend} from './legend/SteppedLegend';

type ColorScaleLegendProps = {
  legends: ResolvedColorLegend[];
  className?: string;
  width?: number;
  swatchColumns?: number;
  defaultCollapsed?: boolean;
};

export function ColorScaleLegend({
  legends,
  className,
  width = 280,
  swatchColumns = 1,
  defaultCollapsed = false,
}: ColorScaleLegendProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  if (!legends.length) {
    return null;
  }

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className={cn(
          'border-border/70 bg-background/90 text-muted-foreground hover:text-foreground pointer-events-auto flex w-fit items-center gap-1 rounded-md border px-2 py-1 text-[10px] leading-none font-medium shadow-sm backdrop-blur-sm transition-colors',
          className,
        )}
      >
        Legend
      </button>
    );
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {legends.map((legend, index) => (
        <div
          key={`${legend.title}-${legend.type}`}
          className="border-border/70 bg-background/90 pointer-events-auto relative w-fit max-w-full rounded-md border px-3 py-2.5 shadow-sm backdrop-blur-sm"
        >
          {index === 0 && (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="text-muted-foreground hover:text-foreground absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-sm transition-colors"
              aria-label="Collapse legend"
            >
              <svg width="8" height="8" viewBox="0 0 8 8">
                <path
                  d="M1 1L7 7M7 1L1 7"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          )}
          <div className="text-foreground mb-2 pr-4 text-xs leading-none font-semibold">
            {legend.title}
          </div>
          {legend.type === 'continuous' && (
            <ContinuousLegend legend={legend} width={width} />
          )}
          {legend.type === 'stepped' && (
            <SteppedLegend legend={legend} width={width} />
          )}
          {legend.type === 'categorical' && (
            <CategoricalLegend
              legend={legend}
              columns={Math.max(1, Math.round(swatchColumns))}
            />
          )}
        </div>
      ))}
    </div>
  );
}
