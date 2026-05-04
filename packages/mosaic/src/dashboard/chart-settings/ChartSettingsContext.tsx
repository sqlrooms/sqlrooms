import {createContext, type ReactNode, useContext} from 'react';
import type {TableColumn} from '@sqlrooms/duckdb';
import type {VgPlotChartConfig} from '../../chart-types';

interface ChartSettingsContextValue {
  tableName?: string;
  config: VgPlotChartConfig;
  columns: TableColumn[];
  onChange: (config: VgPlotChartConfig) => void;
}

const ChartSettingsContext = createContext<ChartSettingsContextValue | null>(
  null,
);

export function useChartSettingsContext() {
  const context = useContext(ChartSettingsContext);
  if (!context) {
    throw new Error(
      'ChartSettings compound components must be used within ChartSettings.Root',
    );
  }
  return context;
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
