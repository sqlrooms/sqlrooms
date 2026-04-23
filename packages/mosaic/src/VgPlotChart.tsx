import {Param, Selection} from '@uwdata/mosaic-core';
import {astToDOM, parseSpec, Spec} from '@uwdata/mosaic-spec';
import {FC, memo, useCallback, useState} from 'react';
import {CrossFade} from './CrossFade';
import {PlotSize, ResponsivePlot} from './ResponsivePlot';

type SpecProps = {
  spec: Spec;
  /**
   * Pre-defined params/selections to inject when rendering the spec.
   * Keys are param names (without $), values are Param or Selection instances.
   * This allows multiple independently-rendered specs to share the same
   * Selection objects for cross-filtering.
   */
  params?: Map<string, Param<any> | Selection>;
};
type PlotProps = {plot: HTMLElement | SVGSVGElement};
type VgPlotChartProps = SpecProps | PlotProps;

export function isSpecProps(props: VgPlotChartProps): props is SpecProps {
  return 'spec' in props;
}

export function isPlotProps(props: VgPlotChartProps): props is PlotProps {
  return 'plot' in props;
}

async function renderChartElement(
  props: VgPlotChartProps,
  size: PlotSize,
): Promise<HTMLElement | SVGSVGElement> {
  if (isPlotProps(props)) {
    return props.plot;
  }

  if (isSpecProps(props)) {
    const spec = {
      ...props.spec,
      width: size.width,
      height: size.height,
    } as Spec;

    const ast = await parseSpec(spec);
    const options = props.params
      ? {params: props.params as unknown as Map<string, Param<any>>}
      : undefined;

    return (await astToDOM(ast, options)).element;
  }

  const errorElement = document.createElement('div');
  errorElement.innerHTML = 'Error: Invalid props provided to VgPlotChart';
  return errorElement;
}

/**
 * Renders a Vega-Lite chart using the Mosaic library.
 *
 * @param {VgPlotChartProps} props - The component props.
 * @param {Spec} props.spec - The Vega-Lite specification for the chart.
 * @returns {React.ReactElement} The rendered chart component.
 */
export const VgPlotChart: FC<VgPlotChartProps> = memo(
  (props) => {
    const [containerSize, setContainerSize] = useState<PlotSize | null>(null);

    const handleResize = useCallback((size: PlotSize) => {
      setContainerSize((prev) => {
        if (prev && prev.width === size.width && prev.height === size.height) {
          return prev;
        }
        return size;
      });
    }, []);

    const renderChart = useCallback(
      async (container: HTMLDivElement) => {
        if (!containerSize) return;
        const element = await renderChartElement(props, containerSize);
        container.replaceChildren(element);
      },
      [props, containerSize],
    );

    return (
      <ResponsivePlot onResize={handleResize} className="h-full w-full">
        <CrossFade
          renderContent={renderChart}
          contentKey={[props, containerSize]}
          className="h-full w-full"
          duration={600}
        />
      </ResponsivePlot>
    );
  },
  (prevProps, nextProps) => {
    if (isPlotProps(prevProps) && isPlotProps(nextProps)) {
      return prevProps.plot === nextProps.plot;
    }
    if (isSpecProps(prevProps) && isSpecProps(nextProps)) {
      const specEqual =
        JSON.stringify(prevProps.spec) === JSON.stringify(nextProps.spec);
      const paramsEqual = prevProps.params === nextProps.params;
      return specEqual && paramsEqual;
    }
    return false;
  },
);

VgPlotChart.displayName = 'VgPlotChart';
