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
};

export function ColorScaleLegend({
  legends,
  className,
  width = 280,
  swatchColumns = 1,
}: ColorScaleLegendProps) {
  if (!legends.length) {
    return null;
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {legends.map((legend) => (
        <div
          key={`${legend.title}-${legend.type}`}
          className="border-border/70 bg-background/90 w-fit max-w-full rounded-md border px-3 py-2.5 shadow-sm backdrop-blur-sm"
        >
          <div className="text-foreground mb-2 text-xs leading-none font-semibold">
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
