import {Flex, useTheme} from '@chakra-ui/react';
import {VgPlotChartConfig, VgPlotSpec} from '@sqlrooms/vgplot';
import {parseSpec, astToDOM} from '@uwdata/mosaic-spec';
import {FC, useEffect, useRef} from 'react';
import {useMosaicPlotConn} from './connector';

type Props = {
  chart: VgPlotChartConfig;
};
const VgPlotChart: FC<Props> = (props) => {
  const theme = useTheme();

  const {chart} = props;
  const {coordinator} = useMosaicPlotConn();
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    (async () => {
      if (containerRef.current) {
        const ast = await parseSpec(addDefaultStyle(chart.spec, theme));
        const {
          element, // root DOM element of the application
          params   // Map of all named Params and Selections
        } = await astToDOM(ast);
        containerRef.current?.replaceChildren(element);        
      }
    })();
  }, [chart.spec, containerRef, theme]);

  return (
    <Flex
      ref={containerRef}
      __css={{
        color: theme.colors.textColor,
        '[aria-label="tip"]': {
          fill: theme.colors.tooltipBgColor,
          stroke: theme.colors.gray[700],
        },
      }}
    />
  );
};

function addDefaultStyle(
  spec: VgPlotSpec,
  theme: Record<string, any>,
): VgPlotSpec {
  return {
    ...spec,
    style: {
      ...spec.style,
      // backgroundColor: theme.colors.gray[700],
      backgroundColor: 'transparent',
      fontFamily: theme.fonts.body,
    },
  };
}

export default VgPlotChart;
