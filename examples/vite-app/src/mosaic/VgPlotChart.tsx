import {astToDOM, parseSpec, Spec} from '@uwdata/mosaic-spec';
import {FC, useEffect, useRef} from 'react';

type VgPlotChartProps = {
  spec: Spec;
};
const VgPlotChart: FC<VgPlotChartProps> = ({spec}) => {
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

export default VgPlotChart;
