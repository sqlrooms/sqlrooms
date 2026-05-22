import type {SpecChartTypeDefinition} from '../base-types';
import {LineChartConfig, LineChartSettings} from './schema';
import {titleFromDescription} from '../../chart-builders/chartTypeUtils';
import {LineChartSettingsComponent} from './LineChartSettings';
import {createLineChartAiTool} from './tool';
import {LineChart} from 'lucide-react';
import {createLineChartSpec} from './spec';

const DESCRIPTION = 'Create a line chart of two fields';

export const lineChartChartType: SpecChartTypeDefinition<LineChartConfig> = {
  id: 'line-chart',
  label: 'Line Chart',
  description: DESCRIPTION,
  icon: LineChart,
  schema: LineChartSettings,
  settingsComponent: LineChartSettingsComponent,
  buildTitle: titleFromDescription(DESCRIPTION),
  createTool: createLineChartAiTool,
  getDataPolicy: ({config, maxDataPoints}) =>
    config.settings.xInterval
      ? null
      : {
          maxRows: maxDataPoints,
          reason:
            'Unaggregated line charts render source rows. Add a temporal interval or use an aggregated chart for larger datasets.',
        },
  createSpec: createLineChartSpec,
};
