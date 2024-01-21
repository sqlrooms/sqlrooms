import {Text} from '@chakra-ui/react';
import {VgPlotChart} from '@flowmapcity/charts';
import {ChartConfig, ChartTypes} from '@flowmapcity/project-config';
import {FC} from 'react';
type Props = {chart: ChartConfig};

const ChartView: FC<Props> = (props) => {
  const {chart} = props;
  return chart.type === ChartTypes.enum.vgplot ? (
    <VgPlotChart chart={chart} />
  ) : (
    <Text>Unsupported chart type ${chart.type}</Text>
  );
};

export default ChartView;
