/**
 * Chart settings compound component for configuring chart types and their parameters.
 *
 * @example
 * ```tsx
 * <ChartSettings.Root
 *   tableName={tableName}
 *   config={config}
 *   columns={columns}
 *   onChange={handleChange}
 * >
 *   <ChartSettings.TypeSelector />
 *   <ChartSettings.Fields />
 * </ChartSettings.Root>
 * ```
 */
import {type FC, type PropsWithChildren} from 'react';
import {DynamicChartSettings} from './DynamicChartSettings';
import {ChartTypeSelector} from './ChartTypeSelector';
import {
  ChartSettingsProvider,
  useChartSettingsContext,
} from './ChartSettingsContext';
import type {TableColumn} from '@sqlrooms/duckdb';
import {type VgPlotChartConfig, type VgPlotChartType} from '../../chart-types';
import {generateMosaicChartSpec} from '../generateMosaicChartSpec';
import {getChartTypeDefinition} from '../../chart-types/registry';

interface ChartSettingsRootProps {
  tableName?: string;
  config: VgPlotChartConfig;
  columns: TableColumn[];
  onChange: (config: VgPlotChartConfig) => void;
}

const ChartSettingsRoot: FC<PropsWithChildren<ChartSettingsRootProps>> = ({
  tableName,
  config,
  columns,
  onChange,
  children,
}) => {
  return (
    <ChartSettingsProvider
      tableName={tableName}
      config={config}
      columns={columns}
      onChange={onChange}
    >
      <div className="space-y-4">{children}</div>
    </ChartSettingsProvider>
  );
};

const ChartSettingsTypeSelector: FC = () => {
  const {config, columns, onChange} = useChartSettingsContext();

  const handleChartTypeChange = (newChartType: VgPlotChartType) => {
    // When changing chart type, clear settings and don't show chart
    // until user selects all required fields
    onChange({
      chartType: newChartType,
      settings: {},
      vgplot: null,
      settingsOpen: config.settingsOpen,
    });
  };

  return (
    <ChartTypeSelector
      value={config.chartType}
      columns={columns}
      onChange={handleChartTypeChange}
    />
  );
};

const ChartSettingsFields: FC = () => {
  const {tableName, config, columns, onChange} = useChartSettingsContext();
  const chartTypeDef = getChartTypeDefinition(config.chartType);

  if (!chartTypeDef) {
    console.error(`[ChartSettings] Unknown chart type: ${config.chartType}`);
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center p-4 text-sm">
        Unknown chart type: {config.chartType}
      </div>
    );
  }

  if (columns.length === 0) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center p-4 text-sm">
        No columns available
      </div>
    );
  }

  return (
    <DynamicChartSettings
      chartTypeDefinition={chartTypeDef}
      columns={columns.map((col) => ({name: col.name, type: col.type}))}
      values={config.settings}
      onChange={(newSettings) => {
        // Check if all required fields are filled
        const allRequiredFieldsFilled = chartTypeDef.fields
          .filter((field) => field.required)
          .every((field) => {
            const value = newSettings[field.key];
            return value !== undefined && value !== null && value !== '';
          });

        onChange({
          ...config,
          settings: newSettings,
          vgplot: allRequiredFieldsFilled
            ? generateMosaicChartSpec(tableName, config.chartType, newSettings)
            : null,
        });
      }}
    />
  );
};

// Compound component API
export const ChartSettings = {
  Root: ChartSettingsRoot,
  TypeSelector: ChartSettingsTypeSelector,
  Fields: ChartSettingsFields,
};
