import {createContext, useContext} from 'react';
import {useStore} from 'zustand';
import type {VgPlotChartConfig} from '../chart-types';
import type {
  ChartBuilderStore,
  ChartBuilderStoreState,
} from './createChartBuilderStore';
import type {ChartBuilderColumn, ChartBuilderTemplate} from './types';

export type ChartBuilderContextValue = {
  tableName: string;
  columns: ChartBuilderColumn[];
  onCreateChart: (title: string, config: VgPlotChartConfig) => void;
  templates: ChartBuilderTemplate[];
  availableTemplates: ChartBuilderTemplate[];
  store: ChartBuilderStore;
};

export const ChartBuilderContext =
  createContext<ChartBuilderContextValue | null>(null);

export function useChartBuilderContext(): ChartBuilderContextValue {
  const ctx = useContext(ChartBuilderContext);
  if (!ctx) {
    throw new Error(
      'ChartBuilder compound components must be rendered inside <MosaicChartBuilder>.',
    );
  }
  return ctx;
}

export function useChartBuilderStore<T>(
  selector: (state: ChartBuilderStoreState) => T,
): T {
  const {store} = useChartBuilderContext();
  return useStore(store, selector);
}
