import {createContext, type ReactNode, useCallback, useContext} from 'react';
import type {TableColumn} from '@sqlrooms/duckdb';
import type {ChartConfig} from '../../chart-types/chart-config';
import type {ChartType} from '../../chart-types/base-types';
import {ColumnsProvider} from '../../chart-builders/ColumnsContext';

type ChartSetting<T extends ChartConfig = ChartConfig> = T['settings'];

interface ChartSettingsContextValue<T extends ChartConfig = ChartConfig> {
  config: T;
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
type ExtractChartConfig<T extends ChartType> = Extract<
  ChartConfig,
  {chartType: T}
>;

export function useChartSettingsContext(): ChartSettingsContextValue<ChartConfig>;
export function useChartSettingsContext<T extends ChartType>(
  chartType: T,
): ChartSettingsContextValue<ExtractChartConfig<T>>;
export function useChartSettingsContext<T extends ChartType>(
  chartType?: T,
):
  | ChartSettingsContextValue<ExtractChartConfig<T>>
  | ChartSettingsContextValue<ChartConfig> {
  const context = useContext(ChartSettingsContext);

  if (!context) {
    throw new Error(
      'ChartSettings compound components must be used within ChartSettings.Root',
    );
  }

  if (!chartType) {
    return context as unknown as ChartSettingsContextValue<ChartConfig>;
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
  config: ChartConfig;
  columns: TableColumn[];
  onChange: (config: ChartConfig) => void;
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
      } as ChartConfig);
    },
    [config, onChange],
  );

  return (
    <ColumnsProvider columns={columns} tableName={tableName}>
      <ChartSettingsContext.Provider
        value={{
          config,
          onChange,
          onChangeConfig,
        }}
      >
        {children}
      </ChartSettingsContext.Provider>
    </ColumnsProvider>
  );
}
