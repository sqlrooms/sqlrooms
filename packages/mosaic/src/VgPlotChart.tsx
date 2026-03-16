import {Param} from '@uwdata/mosaic-core';
import {astToDOM, parseSpec, Spec} from '@uwdata/mosaic-spec';
import {FC, useEffect, useRef} from 'react';

type SpecProps = {
  spec: Spec;
  /**
   * Pre-defined params/selections to inject when rendering the spec.
   * Keys are param names (without $), values are Param or Selection instances.
   * This allows multiple independently-rendered specs to share the same
   * Selection objects for cross-filtering.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params?: Map<string, Param<any>>;
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
export const VgPlotChart: FC<VgPlotChartProps> = (props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    (async () => {
      if (containerRef.current) {
        let element: HTMLElement | SVGSVGElement;
        if (isPlotProps(props)) {
          element = props.plot;
        } else if (isSpecProps(props)) {
          const ast = await parseSpec(props.spec);
          const options = props.params ? {params: props.params} : undefined;
          element = (await astToDOM(ast, options)).element;
        } else {
          element = document.createElement('div');
          element.innerHTML = 'Error: Invalid props provided to VgPlotChart';
        }
        containerRef.current?.replaceChildren(element);
      }
    })();
  }, [props, containerRef]);

  return <div ref={containerRef} />;
};
