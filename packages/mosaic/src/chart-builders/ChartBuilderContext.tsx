import {createContext, useContext} from 'react';
import type {Spec} from '@uwdata/mosaic-spec';
import {useStore} from 'zustand';
import type {
  ChartBuilderStore,
  ChartBuilderStoreState,
} from './createChartBuilderStore';
import type {
  ChartBuilderColumn,
  ChartBuilderTemplate,
  ChartTypeDefinition,
} from './types';

export type ChartBuilderContextValue = {
  tableName: string;
  columns: ChartBuilderColumn[];
  onCreateChart: (spec: Spec, title: string) => void;
  templates: ChartBuilderTemplate[];
  availableChartTypes: ChartTypeDefinition[];
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
