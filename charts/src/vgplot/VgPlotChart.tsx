import {Flex, useTheme} from '@chakra-ui/react';
import {VgPlotChartConfig, VgPlotSpec} from '@sqlrooms/project-config';
import {parseSpec} from '@uwdata/vgplot';
import {FC, useEffect, useRef} from 'react';
import {useMosaicPlotConn} from './connector';

type Props = {
  chart: VgPlotChartConfig;
};
const VgPlotChart: FC<Props> = (props) => {
  const theme = useTheme();

  const {chart} = props;
  useMosaicPlotConn();
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    (async () => {
      if (containerRef.current) {
        // TODO: update when filter changes
        containerRef.current?.replaceChildren(
          await parseSpec(addDefaultStyle(chart.spec, theme)),
        );
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
