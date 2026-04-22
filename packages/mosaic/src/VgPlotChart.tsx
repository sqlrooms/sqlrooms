import {Param, Selection} from '@uwdata/mosaic-core';
import {astToDOM, parseSpec, Spec} from '@uwdata/mosaic-spec';
import {FC, memo, useEffect, useRef, useState} from 'react';
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

/**
 * Renders a Vega-Lite chart using the Mosaic library.
 *
 * @param {VgPlotChartProps} props - The component props.
 * @param {Spec} props.spec - The Vega-Lite specification for the chart.
 * @returns {React.ReactElement} The rendered chart component.
 */
export const VgPlotChart: FC<VgPlotChartProps> = memo(
  (props) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerSize, setContainerSize] = useState<PlotSize | null>(null);

    useEffect(() => {
      let cancelled = false;
      (async () => {
        if (containerRef.current && containerSize) {
          let element: HTMLElement | SVGSVGElement;
          if (isPlotProps(props)) {
            element = props.plot;
          } else if (isSpecProps(props)) {
            // Inject container dimensions into spec for responsive sizing
            const responsiveSpec = {
              ...props.spec,
              width: containerSize.width,
              height: containerSize.height,
            } as Spec;

            const ast = await parseSpec(responsiveSpec);
            if (cancelled) return;
            const options = props.params
              ? ({
                  // Mosaic selections are valid runtime params for astToDOM,
                  // but the upstream type currently narrows this map to Param.
                  params: props.params as unknown as Map<string, Param<any>>,
                } satisfies {params: Map<string, Param<any>>})
              : undefined;
            element = (await astToDOM(ast, options)).element;
          } else {
            element = document.createElement('div');
            element.innerHTML = 'Error: Invalid props provided to VgPlotChart';
          }
          if (!cancelled) {
            containerRef.current?.replaceChildren(element);
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [props, containerSize]);

    return <ResponsivePlot ref={containerRef} onResize={setContainerSize} />;
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
