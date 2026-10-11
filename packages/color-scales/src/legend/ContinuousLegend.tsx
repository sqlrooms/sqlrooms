import type {ResolvedColorLegend} from '../config';
import {LegendTicks} from './LegendTicks';
import {getRampStyle} from './utils';

export function ContinuousLegend({
  legend,
  width,
}: {
  legend: Extract<ResolvedColorLegend, {type: 'continuous'}>;
  width: number;
}) {
  return (
    <div className="min-w-0" style={getRampStyle(width)}>
      <div
        aria-hidden="true"
        className="border-border/70 h-3 rounded-[2px] border shadow-[inset_0_0_0_1px_rgb(255_255_255_/_0.22)]"
        style={{background: legend.gradient}}
      />
      <LegendTicks ticks={legend.ticks} width={width} />
    </div>
  );
}
