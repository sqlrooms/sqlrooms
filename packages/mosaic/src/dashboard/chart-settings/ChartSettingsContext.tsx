import {createContext, type ReactNode, useCallback, useContext} from 'react';
import type {TableColumn} from '@sqlrooms/duckdb';
import type {VgPlotChartConfig} from '../../chart-types/chart-config';
import type {VgPlotChartType} from '../../chart-types/base-types';

type ChartSetting<T extends VgPlotChartConfig = VgPlotChartConfig> =
  T['settings'];

interface ChartSettingsContextValue<
  T extends VgPlotChartConfig = VgPlotChartConfig,
> {
  tableName?: string;
  config: T;
  columns: TableColumn[];
  onChange: (config: T) => void;
  onChangeConfig: <K extends keyof ChartSetting<T>>(
    key: K,
    value: ChartSetting<T>[K],
  ) => void;
}

const ChartSettingsContext = createContext<ChartSettingsContextValue | null>(
  null,
);

// Extract specific config type from the discriminated union by chartType
type ExtractChartConfig<T extends VgPlotChartType> = Extract<
  VgPlotChartConfig,
  {chartType: T}
>;

export function useChartSettingsContext(): ChartSettingsContextValue<VgPlotChartConfig>;
export function useChartSettingsContext<T extends VgPlotChartType>(
  chartType: T,
): ChartSettingsContextValue<ExtractChartConfig<T>>;
export function useChartSettingsContext<T extends VgPlotChartType>(
  chartType?: T,
):
  | ChartSettingsContextValue<ExtractChartConfig<T>>
  | ChartSettingsContextValue<VgPlotChartConfig> {
  const context = useContext(ChartSettingsContext);

  if (!context) {
    throw new Error(
      'ChartSettings compound components must be used within ChartSettings.Root',
    );
  }

  if (!chartType) {
    return context as unknown as ChartSettingsContextValue<VgPlotChartConfig>;
  }

  if (context.config.chartType !== chartType) {
    throw new Error(
      `${chartType} chart settings must be used within a ${chartType} chart context`,
    );
  }

  return context as unknown as ChartSettingsContextValue<ExtractChartConfig<T>>;
}

interface ChartSettingsProviderProps {
  tableName?: string;
  config: VgPlotChartConfig;
  columns: TableColumn[];
  onChange: (config: VgPlotChartConfig) => void;
  children: ReactNode;
}

export function ChartSettingsProvider({
  tableName,
  config,
  columns,
  onChange,
  children,
}: ChartSettingsProviderProps) {
  const onChangeConfig = useCallback(
    function <K extends keyof ChartSetting>(key: K, value: ChartSetting) {
      onChange({
        ...config,
        settings: {
          ...config.settings,
          [key]: value,
        },
      } as VgPlotChartConfig);
    },
    [config, onChange],
  );

  return (
    <ChartSettingsContext.Provider
      value={{
        tableName,
        config,
        columns,
        onChange,
        onChangeConfig,
      }}
    >
      {children}
    </ChartSettingsContext.Provider>
  );
}
