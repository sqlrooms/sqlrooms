import type {ComponentChartTypeDefinition} from '../base-types';
import {CountPlotChartConfig, CountPlotChartSettings} from './schema';
import {titleFromDescription} from '../../../chart-builders/chartTypeUtils';
import {CountPlotSettingsComponent} from './CountPlotSettings';
import {createCountPlotAiTool} from './tool';
import {BarChartHorizontal} from 'lucide-react';
import {CountPlotPanelRenderer} from './renderer/CountPlotPanelRenderer';

const DESCRIPTION = 'Create a count plot of a field';

export const countPlotChartType: ComponentChartTypeDefinition<CountPlotChartConfig> =
  {
    id: 'count-plot',
    label: 'Count Plot',
    description: DESCRIPTION,
    aiDescription: `${DESCRIPTION} - frequency of categorical values or numeric aggregates by category (aggregates automatically)`,
    icon: BarChartHorizontal,
    schema: CountPlotChartSettings,
    settingsComponent: CountPlotSettingsComponent,
    buildTitle: titleFromDescription(DESCRIPTION),
    createTool: createCountPlotAiTool,
    renderer: CountPlotPanelRenderer,
  };
