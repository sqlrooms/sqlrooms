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
import {type FC, type PropsWithChildren, useCallback, useMemo} from 'react';
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
import {Button} from '@sqlrooms/ui';
import {XIcon} from 'lucide-react';

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
      {children}
    </ChartSettingsProvider>
  );
};

type ChartSettingsHeaderProps = PropsWithChildren<{
  onClose?: () => void;
}>;

const ChartSettingsHeader: FC<ChartSettingsHeaderProps> = ({
  children,
  onClose,
}) => {
  return (
    <div className="flex items-center justify-between border-b px-3 py-1.5 text-xs font-medium">
      {children}
      {onClose && (
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={onClose}
        >
          <XIcon className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
};

const ChartSettingsContent: FC<PropsWithChildren> = ({children}) => {
  return <div className="flex flex-col gap-2 p-2">{children}</div>;
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

  // Memoize columns mapping
  const mappedColumns = useMemo(
    () => columns.map((col) => ({name: col.name, type: col.type})),
    [columns],
  );

  const handleSettingsChange = useCallback(
    (newSettings: Record<string, unknown>) => {
      if (!chartTypeDef) return;

      // Check if all required fields are filled
      const allRequiredFieldsFilled = chartTypeDef.fields
        .filter((field) => field.required !== false)
        .every((field) => {
          const value = newSettings[field.key];
          return value !== undefined && value !== null && value !== '';
        });

      // Generate spec
      const vgplot = allRequiredFieldsFilled
        ? generateMosaicChartSpec(tableName, config.chartType, newSettings)
        : null;

      onChange({
        ...config,
        settings: newSettings,
        vgplot,
      });
    },
    [chartTypeDef, config, onChange, tableName],
  );

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
      columns={mappedColumns}
      values={config.settings}
      onChange={handleSettingsChange}
    />
  );
};

export const ChartSettings = {
  Root: ChartSettingsRoot,
  Header: ChartSettingsHeader,
  Content: ChartSettingsContent,
  TypeSelector: ChartSettingsTypeSelector,
  Fields: ChartSettingsFields,
};
