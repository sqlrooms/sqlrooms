import type {ComponentChartTypeDefinition} from '../base-types';
import {BoxPlotChartConfig, BoxPlotChartSettings} from './schema';
import {titleFromDescription} from '../../../chart-builders/chartTypeUtils';
import {BoxPlotPanelRenderer} from './renderer/BoxPlotPanelRenderer';
import {BoxPlotSettingsComponent} from './BoxPlotSettings';
import {createBoxPlotAiTool} from './tool';
import {AlignHorizontalDistributeCenter} from 'lucide-react';
import {DEFAULT_CHART_MAX_DATA_POINTS} from '../../../chart-runtime';

const DESCRIPTION = 'Create a box plot';

export const boxPlotChartType: ComponentChartTypeDefinition<BoxPlotChartConfig> =
  {
    id: 'box-plot',
    label: 'Box Plot',
    description: DESCRIPTION,
    icon: AlignHorizontalDistributeCenter,
    schema: BoxPlotChartSettings,
    settingsComponent: BoxPlotSettingsComponent,
    buildTitle: titleFromDescription(DESCRIPTION),
    renderer: BoxPlotPanelRenderer,
    createTool: createBoxPlotAiTool,
    getDataPolicy: () => ({
      maxRows: DEFAULT_CHART_MAX_DATA_POINTS,
      reason:
        'Box plots render summaries plus outlier points. Too many outliers can make the chart too expensive to render.',
    }),
  };
