import {useMemo} from 'react';
import type {Spec} from '@uwdata/mosaic-spec';
import {ChartSpecError} from './chart-types/errors';
import type {ChartConfig, ChartSettings} from './chart-types/chart-config';
import {
  ComponentChartTypeDefinition,
  isComponentChartType,
  isSpecChartType,
  SpecChartTypeDefinition,
} from './chart-types/base-types';
import {useChartTypeDefinition} from './useChartTypeDefinition';
import {DataTable} from '@sqlrooms/db';

export type MosaicComponentChartRenderContext = {
  type: 'component';
  renderer: ComponentChartTypeDefinition['renderer'];
  dataTable: DataTable;
};

export type MosaicSpecChartRenderContext = {
  type: 'spec';
  spec: Spec;
};

export type MosaicChartRenderErrorContext = {
  type: 'error';
  error: Error;
};

export type MosaicChartRenderContext =
  | MosaicComponentChartRenderContext
  | MosaicSpecChartRenderContext
  | MosaicChartRenderErrorContext;

export function useMosaicChartRenderContext(
  dataTable: DataTable | undefined,
  config: ChartConfig,
  selectionName?: string,
): MosaicChartRenderContext {
  const chartTypeDefinition = useChartTypeDefinition(config.chartType);

  return useMemo(() => {
    if (!chartTypeDefinition) {
      return {
        type: 'error',
        error: new Error(`Invalid chart type definition`),
      };
    }

    if (!dataTable) {
      return {
        type: 'error',
        error: new Error('Data table is required to render the chart'),
      };
    }

    if (isSpecChartType(chartTypeDefinition)) {
      return createMosaicSpecChartRenderContext(
        chartTypeDefinition,
        dataTable,
        config.settings,
        selectionName,
      );
    }

    if (isComponentChartType(chartTypeDefinition)) {
      return {
        type: 'component',
        renderer: chartTypeDefinition.renderer,
        dataTable,
      };
    }

    return {
      type: 'error',
      error: new Error('Unsupported chart type definition'),
    };
  }, [chartTypeDefinition, dataTable, config, selectionName]);
}

function createMosaicSpecChartRenderContext<TConfig extends ChartConfig>(
  chartTypeDefinition: SpecChartTypeDefinition<TConfig>,
  dataTable: DataTable,
  settings: ChartSettings,
  selectionName?: string,
): MosaicSpecChartRenderContext | MosaicChartRenderErrorContext {
  try {
    const spec = chartTypeDefinition.createSpec({
      dataTable,
      settings,
      selectionName,
    });

    return {
      type: 'spec',
      spec,
    };
  } catch (error) {
    if (error instanceof ChartSpecError) {
      // ChartSpecError is expected as part of validation logic, don't log
      return {
        type: 'error',
        error,
      };
    }

    console.error('Unexpected error creating chart spec:', error);

    return {
      type: 'error',
      error: new Error(
        'An unexpected error occurred while creating the chart spec',
      ),
    };
  }
}
