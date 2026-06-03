import {createContext, type ReactNode, useCallback, useContext} from 'react';
import type {TableColumn} from '@sqlrooms/db';
import type {ChartConfig} from '../chart-types/chart-config';
import type {ChartType} from '../chart-types/base-types';
import {ColumnsProvider} from '../../chart-builders/ColumnsContext';

type ChartSetting<T extends ChartConfig = ChartConfig> = T['settings'];

interface MosaicChartSettingsContextValue<T extends ChartConfig = ChartConfig> {
  config: T;
  onChange: (config: T) => void;
  onChangeConfig: <K extends keyof ChartSetting<T>>(
    key: K,
    value: ChartSetting<T>[K],
  ) => void;
}

const MosaicChartSettingsContext =
  createContext<MosaicChartSettingsContextValue | null>(null);

// Extract specific config type from the discriminated union by chartType
type ExtractChartConfig<T extends ChartType> = Extract<
  ChartConfig,
  {chartType: T}
>;

export function useMosaicChartSettingsContext(): MosaicChartSettingsContextValue<ChartConfig>;
export function useMosaicChartSettingsContext<T extends ChartType>(
  chartType: T,
): MosaicChartSettingsContextValue<ExtractChartConfig<T>>;
export function useMosaicChartSettingsContext<T extends ChartType>(
  chartType?: T,
):
  | MosaicChartSettingsContextValue<ExtractChartConfig<T>>
  | MosaicChartSettingsContextValue<ChartConfig> {
  const context = useContext(MosaicChartSettingsContext);

  if (!context) {
    throw new Error(
      'MosaicChartSettings compound components must be used within MosaicChartSettings.Root',
    );
  }

  if (!chartType) {
    return context as unknown as MosaicChartSettingsContextValue<ChartConfig>;
  }

  if (context.config.chartType !== chartType) {
    throw new Error(
      `${chartType} chart settings must be used within a ${chartType} chart context`,
    );
  }

  return context as unknown as MosaicChartSettingsContextValue<
    ExtractChartConfig<T>
  >;
}

interface MosaicChartSettingsProviderProps {
  config: ChartConfig;
  columns: TableColumn[];
  onChange: (config: ChartConfig) => void;
  children: ReactNode;
}

export function MosaicChartSettingsProvider({
  config,
  columns,
  onChange,
  children,
}: MosaicChartSettingsProviderProps) {
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
    <ColumnsProvider columns={columns}>
      <MosaicChartSettingsContext.Provider
        value={{
          config,
          onChange,
          onChangeConfig,
        }}
      >
        {children}
      </MosaicChartSettingsContext.Provider>
    </ColumnsProvider>
  );
}
