import {astToDOM, parseSpec, Spec} from '@uwdata/mosaic-spec';
import {FC, useEffect, useRef} from 'react';

type VgPlotChartProps = {
  spec: Spec;
};
/**
 * Renders a Vega-Lite chart using the Mosaic library.
 *
 * @param {VgPlotChartProps} props - The component props.
 * @param {Spec} props.spec - The Vega-Lite specification for the chart.
 * @returns {React.ReactElement} The rendered chart component.
 */
export const VgPlotChart: FC<VgPlotChartProps> = ({spec}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    (async () => {
      if (containerRef.current) {
        const ast = await parseSpec(spec);
        const {
          element, // root DOM element of the application
        } = await astToDOM(ast);
        containerRef.current?.replaceChildren(element);
      }
    })();
  }, [spec, containerRef]);

  return <div ref={containerRef} />;
};
