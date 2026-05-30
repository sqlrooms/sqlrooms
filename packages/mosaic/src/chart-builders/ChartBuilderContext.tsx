import {createContext, useContext} from 'react';
import {useStore} from 'zustand';
import type {ChartConfig} from '../chart-types';
import type {
  ChartBuilderStore,
  ChartBuilderStoreState,
} from './createChartBuilderStore';
import type {
  ChartBuilderColumn,
  ChartTypeDefinition,
} from '../chart-types/base-types';

export type ChartBuilderContextValue = {
  tableName: string;
  columns: ChartBuilderColumn[];
  onCreateChart: (title: string, config: ChartConfig) => void;
  templates: ChartTypeDefinition[];
  availableTemplates: ChartTypeDefinition[];
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
