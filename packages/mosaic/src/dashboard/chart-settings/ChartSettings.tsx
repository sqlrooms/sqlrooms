import {FC, useMemo} from 'react';
import {ChartTypeSelector} from './ChartTypeSelector';
import {ChartSettingsSelector} from './ChartSettingsSelector';
import {VgPlotChartConfig, VgPlotChartType} from '../ChartSchemas';
import {generateMosaicChartSpec} from '../generateMosaicChartSpec';
import {useStoreWithMosaicDashboard} from '../MosaicDashboardSlice';

interface ChartSettingsProps {
  tableName?: string;
  config: VgPlotChartConfig;
  onChange: (settings: VgPlotChartConfig) => void;
}

export const ChartSettings: FC<ChartSettingsProps> = ({
  tableName,
  config,
  onChange,
}) => {
  const tables = useStoreWithMosaicDashboard((state) => state.db.tables);

  const resolvedTable = useMemo(() => {
    if (!tableName) return undefined;
    return tables.find((t) => t.table.table === tableName);
  }, [tableName, tables]);

  const columns = resolvedTable?.columns || [];

  const handleChartTypeChange = (newChartType: VgPlotChartType) => {
    const settings = {};

    onChange({
      ...config,
      chartType: newChartType,
      settings,
      vgplot: generateMosaicChartSpec(tableName, newChartType, settings),
    });
  };

  return (
    <div className="space-y-4">
      <ChartTypeSelector
        value={config.chartType}
        columns={columns}
        onChange={handleChartTypeChange}
      />

      <ChartSettingsSelector
        tableName={tableName}
        config={config}
        columns={columns}
        onChange={onChange}
      />
    </div>
  );
};
