import {createContext, useContext} from 'react';
import type {Spec} from '@uwdata/mosaic-spec';
import type {ChartBuilderColumn, ChartBuilderTemplate} from './types';

export type ChartBuilderContextValue = {
  tableName: string;
  columns: ChartBuilderColumn[];
  onCreateChart: (spec: Spec, title: string) => void;
  builders?: ChartBuilderTemplate[];
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
