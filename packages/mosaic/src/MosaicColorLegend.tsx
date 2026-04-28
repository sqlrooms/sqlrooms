import type {ColorScaleConfig} from '@sqlrooms/color-scales';
import {resolveColorLegendTitle} from '@sqlrooms/color-scales';
import {cn, getResolvedTheme, useTheme} from '@sqlrooms/ui';
import {Selection} from '@uwdata/mosaic-core';
import * as vg from '@uwdata/vgplot';
import {useMemo} from 'react';
import {VgPlotChart} from './VgPlotChart';

type LegendDomainValue = string | number | Date;

type CreateMosaicColorLegendPlotOptions = {
  colorScale: ColorScaleConfig;
  selection?: Selection;
  domain?: ReadonlyArray<LegendDomainValue>;
  title?: string;
  width?: number;
  tickFormat?: string;
};

export type MosaicColorLegendProps = CreateMosaicColorLegendPlotOptions & {
  className?: string;
};

function isExplicitNumericDomain(
  domain: 'auto' | [number, number] | [number, number, number],
): domain is [number, number] | [number, number, number] {
  return domain !== 'auto';
}

function resolveLegendDomain(
  colorScale: ColorScaleConfig,
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

function getVgColorScaleType(colorScale: ColorScaleConfig) {
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
    default: {
      const _exhaustive: never = colorScale;
      throw new Error(
        `Unknown color scale type: ${(_exhaustive as ColorScaleConfig).type}`,
      );
    }
  }
}

function supportsInteractiveLegend(colorScale: ColorScaleConfig) {
  return (
    colorScale.type === 'sequential' ||
    colorScale.type === 'diverging' ||
    colorScale.type === 'categorical'
  );
}

export function createMosaicColorLegendPlot({
  colorScale,
  selection,
  domain,
  title,
  width = 220,
  tickFormat = '.1f',
}: CreateMosaicColorLegendPlotOptions) {
  const resolvedDomain = resolveLegendDomain(colorScale, domain);
  const legendTitle = resolveColorLegendTitle(colorScale, title);
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
    as: supportsInteractiveLegend(colorScale) ? selection : undefined,
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

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const plot = useMemo(
    () =>
      createMosaicColorLegendPlot({
        colorScale,
        selection,
        domain,
        title,
        width,
        tickFormat,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deep-equal via serialized key instead of object refs
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
