import type {SpecChartTypeDefinition} from '../base-types';
import {CountPlotChartConfig, CountPlotChartSettings} from './schema';
import {titleFromDescription} from '../../chart-builders/chartTypeUtils';
import {CountPlotSettingsComponent} from './CountPlotSettings';
import {createCountPlotAiTool} from './tool';
import {BarChartHorizontal} from 'lucide-react';
import {createCountPlotSpec} from './spec';

const DESCRIPTION = 'Create a count plot of a field';

export const countPlotChartType: SpecChartTypeDefinition<CountPlotChartConfig> =
  {
    id: 'count-plot',
    label: 'Count Plot',
    description: DESCRIPTION,
    aiDescription:
      'Use for showing frequency/count of categorical values as horizontal bars. Best for discrete text/enum columns, not numeric distributions.',
    icon: BarChartHorizontal,
    schema: CountPlotChartSettings,
    settingsComponent: CountPlotSettingsComponent,
    buildTitle: titleFromDescription(DESCRIPTION),
    createTool: createCountPlotAiTool,
    createSpec: createCountPlotSpec,
  };
