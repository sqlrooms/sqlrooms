import {createContext, type ReactNode, useContext} from 'react';
import type {TableColumn} from '@sqlrooms/duckdb';
import type {VgPlotChartConfig, VgPlotChartType} from '../../chart-types';

interface ChartSettingsContextValue<T = VgPlotChartConfig> {
  tableName?: string;
  config: T;
  columns: TableColumn[];
  onChange: (config: T) => void;
}

const ChartSettingsContext = createContext<ChartSettingsContextValue | null>(
  null,
);

// export function useChartSettingsContext() {
//   const context = useContext(ChartSettingsContext);

//   if (!context) {
//     throw new Error(
//       'ChartSettings compound components must be used within ChartSettings.Root',
//     );
//   }
//   return context;
// }

// Extract specific config type from the discriminated union by chartType
type ExtractChartConfig<T extends VgPlotChartType> = Extract<
  VgPlotChartConfig,
  {chartType: T}
>;

/**
 * Get strongly-typed chart settings context for a specific chart type.
 *
 * @example
 * // In a histogram-specific component:
 * const {config, onChange} = useConcreteChartSettingsContext('histogram');
 * // config is typed as HistogramChartConfig
 * const field = config.settings.field; // TypeScript knows this is string
 *
 * @example
 * // In a bubble chart component:
 * const {config} = useConcreteChartSettingsContext('bubble-chart');
 * // config is typed as BubbleChartConfig
 * const x = config.settings.x;
 * const y = config.settings.y;
 */
export function useChartSettingsContext(): ChartSettingsContextValue<VgPlotChartType>;
export function useChartSettingsContext<T extends VgPlotChartType>(
  chartType: T,
): ChartSettingsContextValue<ExtractChartConfig<T>>;
export function useChartSettingsContext<T extends VgPlotChartType>(
  chartType?: T,
):
  | ChartSettingsContextValue<ExtractChartConfig<T>>
  | ChartSettingsContextValue<VgPlotChartType> {
  const context = useContext(ChartSettingsContext);

  if (!context) {
    throw new Error(
      'ChartSettings compound components must be used within ChartSettings.Root',
    );
  }

  if (!chartType) {
    return context as unknown as ChartSettingsContextValue<VgPlotChartType>;
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
  return (
    <ChartSettingsContext.Provider
      value={{tableName, config, columns, onChange}}
    >
      {children}
    </ChartSettingsContext.Provider>
  );
}
