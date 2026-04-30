import {FC} from 'react';
import {LineSettings} from './LineSettings';
import {BubbleSettings} from './BubbleSettings';
import {HeatmapSettings} from './HeatmapSettings';
import {HistogramSettings} from './HistogramSettings';
import {CountPlotSettings} from './CountPlotSettings';
import {EcdfSettings} from './EcdfSettings';
import {BoxPlotSettings} from './BoxPlotSettings';
import type {TableColumn} from '@sqlrooms/duckdb';
import {VgPlotChartConfig} from '../ChartSchemas';
import {generateMosaicChartSpec} from '../generateMosaicChartSpec';

interface ChartSettingsSelectorProps {
  tableName?: string;
  config: VgPlotChartConfig;
  columns: TableColumn[];
  onChange: (config: VgPlotChartConfig) => void;
}

export const ChartSettingsSelector: FC<ChartSettingsSelectorProps> = ({
  tableName,
  config,
  columns,
  onChange,
}) => {
  switch (config.chartType) {
    case 'line-chart':
      return (
        <LineSettings
          settings={config.settings}
          columns={columns}
          onChange={(newSettings) =>
            onChange({
              ...config,
              settings: newSettings,
              vgplot: generateMosaicChartSpec(
                tableName,
                config.chartType,
                newSettings,
              ),
            })
          }
        />
      );

    case 'bubble-chart':
      return (
        <BubbleSettings
          settings={config.settings}
          columns={columns}
          onChange={(newSettings) =>
            onChange({
              ...config,
              settings: newSettings,
              vgplot: generateMosaicChartSpec(
                tableName,
                config.chartType,
                newSettings,
              ),
            })
          }
        />
      );

    case 'heatmap':
      return (
        <HeatmapSettings
          settings={config.settings}
          columns={columns}
          onChange={(newSettings) =>
            onChange({
              ...config,
              settings: newSettings,
              vgplot: generateMosaicChartSpec(
                tableName,
                config.chartType,
                newSettings,
              ),
            })
          }
        />
      );

    case 'histogram':
      return (
        <HistogramSettings
          settings={config.settings}
          columns={columns}
          onChange={(newSettings) =>
            onChange({
              ...config,
              settings: newSettings,
              vgplot: generateMosaicChartSpec(
                tableName,
                config.chartType,
                newSettings,
              ),
            })
          }
        />
      );

    case 'count-plot':
      return (
        <CountPlotSettings
          settings={config.settings}
          columns={columns}
          onChange={(newSettings) =>
            onChange({
              ...config,
              settings: newSettings,
              vgplot: generateMosaicChartSpec(
                tableName,
                config.chartType,
                newSettings,
              ),
            })
          }
        />
      );

    case 'ecdf':
      return (
        <EcdfSettings
          settings={config.settings}
          columns={columns}
          onChange={(newSettings) =>
            onChange({
              ...config,
              settings: newSettings,
              vgplot: generateMosaicChartSpec(
                tableName,
                config.chartType,
                newSettings,
              ),
            })
          }
        />
      );

    case 'box-plot':
      return (
        <BoxPlotSettings
          settings={config.settings}
          columns={columns}
          onChange={(newSettings) =>
            onChange({
              ...config,
              settings: newSettings,
              vgplot: generateMosaicChartSpec(
                tableName,
                config.chartType,
                newSettings,
              ),
            })
          }
        />
      );

    case 'custom-spec':
    default:
      return (
        <div className="text-muted-foreground text-sm">
          No settings available for this chart type
        </div>
      );
  }
};
