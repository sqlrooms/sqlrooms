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
  title: string;
  message: string;
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
        title: 'Ooops! Something went wrong',
        message: 'Invalid chart type definition',
      };
    }

    if (!dataTable) {
      return {
        type: 'error',
        title: 'Ooops! Something went wrong',
        message: 'Please select a data table first',
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
      title: 'Ooops! Something went wrong',
      message: 'Unsupported chart type definition',
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
      tableName: dataTable.table.table,
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
        title: 'Configure chart to display visualization',
        message: error.message,
      };
    }

    return {
      type: 'error',
      title: 'Ooops! Something went wrong',
      message: 'An unexpected error occurred',
    };
  }
}
