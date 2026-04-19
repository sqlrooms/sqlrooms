import type {LayerColorScale} from '@sqlrooms/deck';
import {type Selection, vg, VgPlotChart} from '@sqlrooms/mosaic';
import {cn, getResolvedTheme, useTheme} from '@sqlrooms/ui';
import {useMemo} from 'react';

type LegendDomainValue = string | number | Date;

type CreateColorLegendPlotOptions = {
  colorScale: LayerColorScale;
  selection?: Selection;
  domain?: ReadonlyArray<LegendDomainValue>;
  title?: string;
  width?: number;
  tickFormat?: string;
};

export type MosaicColorLegendProps = CreateColorLegendPlotOptions & {
  className?: string;
};

function isExplicitNumericDomain(
  domain: 'auto' | [number, number] | [number, number, number],
): domain is [number, number] | [number, number, number] {
  return domain !== 'auto';
}

function getLegendTitle(colorScale: LayerColorScale, title?: string) {
  if (title) return title;
  if (colorScale.legend && colorScale.legend.title) {
    return colorScale.legend.title;
  }
  return colorScale.field;
}

function resolveLegendDomain(
  colorScale: LayerColorScale,
  domain?: ReadonlyArray<LegendDomainValue>,
) {
  if (
    (colorScale.type === 'sequential' ||
      colorScale.type === 'diverging' ||
      colorScale.type === 'quantize') &&
    isExplicitNumericDomain(colorScale.domain)
  ) {
    return colorScale.domain;
  }
  return domain;
}

// Mosaic interactive legends currently support ramps and swatches,
// but not interactive threshold / quantize / quantile brushing.
function getVgColorScaleType(colorScale: LayerColorScale) {
  switch (colorScale.type) {
    case 'sequential':
      return 'linear';
    case 'diverging':
      return 'diverging';
    case 'quantize':
      return 'quantize';
    case 'quantile':
      return 'quantile';
    case 'threshold':
      return 'threshold';
    case 'categorical':
      return 'categorical';
  }
}

export function createColorLegendPlot({
  colorScale,
  selection,
  domain,
  title,
  width = 220,
  tickFormat = '.1f',
}: CreateColorLegendPlotOptions) {
  if (colorScale.legend === false) {
    return null;
  }

  const resolvedDomain = resolveLegendDomain(colorScale, domain);
  const legendTitle = getLegendTitle(colorScale, title);
  const plotAttributes: Array<(plot: any) => void> = [
    vg.colorScale(getVgColorScaleType(colorScale)),
    vg.colorScheme(colorScale.scheme),
    vg.colorLabel(legendTitle),
    vg.marginTop(0),
    vg.marginRight(0),
    vg.marginBottom(0),
    vg.marginLeft(0),
  ];

  if ('clamp' in colorScale && colorScale.clamp !== undefined) {
    plotAttributes.push(vg.colorClamp(colorScale.clamp));
  }

  if ('reverse' in colorScale && colorScale.reverse !== undefined) {
    plotAttributes.push(vg.colorReverse(colorScale.reverse));
  }

  if (colorScale.type === 'diverging') {
    if (Array.isArray(resolvedDomain) && resolvedDomain.length === 3) {
      plotAttributes.push(
        vg.colorDomain([resolvedDomain[0], resolvedDomain[2]]),
        vg.colorPivot(resolvedDomain[1]),
      );
    } else if (Array.isArray(resolvedDomain) && resolvedDomain.length === 2) {
      plotAttributes.push(vg.colorDomain(resolvedDomain));
    }
  } else if (colorScale.type === 'threshold') {
    plotAttributes.push(vg.colorDomain(colorScale.thresholds));
  } else if (resolvedDomain) {
    plotAttributes.push(vg.colorDomain(resolvedDomain));
  }

  if (colorScale.type === 'quantize' || colorScale.type === 'quantile') {
    plotAttributes.push(vg.colorN(colorScale.bins ?? 5));
  }

  const backingPlot = vg.plot(...plotAttributes);
  return vg.colorLegend({
    for: backingPlot,
    as: selection,
    field: colorScale.field,
    width,
    tickFormat,
    label: legendTitle,
  });
}

export function MosaicColorLegend({
  colorScale,
  selection,
  domain,
  title,
  width,
  tickFormat,
  className,
}: MosaicColorLegendProps) {
  const {theme} = useTheme();
  const resolvedTheme = getResolvedTheme(theme);
  const legendSpecKey = JSON.stringify({
    colorScale,
    domain,
    title,
    width,
    tickFormat,
  });

  const plot = useMemo(
    () =>
      createColorLegendPlot({
        colorScale,
        selection,
        domain,
        title,
        width,
        tickFormat,
      }),
    [legendSpecKey, selection],
  );

  if (!plot) {
    return null;
  }

  return (
    <div
      className={cn(
        'pointer-events-auto rounded-md border px-3 py-2 shadow-lg backdrop-blur-sm',
        'border-slate-200 bg-white/95 text-slate-900',
        'dark:border-slate-700 dark:bg-[#1f1d1b]/90 dark:text-slate-100',
        '[&_svg]:block [&_svg]:overflow-visible',
        '[&_svg_line]:stroke-current [&_svg_path]:stroke-current [&_svg_text]:fill-current',
        resolvedTheme === 'dark' &&
          '[&_svg_.domain]:stroke-slate-500 [&_svg_line]:stroke-slate-500',
        resolvedTheme === 'light' &&
          '[&_svg_.domain]:stroke-slate-400 [&_svg_line]:stroke-slate-400',
        className,
      )}
    >
      <VgPlotChart plot={plot} />
    </div>
  );
}
