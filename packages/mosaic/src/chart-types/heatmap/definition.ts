import type {ChartTypeDefinition} from '../base-types';
import {HeatmapChartConfig, HeatmapChartSettings} from './schema';
import {titleFromDescription} from '../../chart-builders/chartTypeUtils';
import {HeatmapRenderer} from './HeatmapRenderer';
import {HeatmapSettingsComponent} from './HeatmapSettings';
import {createHeatmapAiTool} from './tool';
import {Grid3X3} from 'lucide-react';

const DESCRIPTION = 'Create a 2D heatmap of two fields';

export const heatmapChartType: ChartTypeDefinition<HeatmapChartConfig> = {
  id: 'heatmap',
  label: 'Heatmap',
  description: DESCRIPTION,
  aiDescription:
    'Use for dense relationships between two numeric columns where point overlap would be high.',
  icon: Grid3X3,
  schema: HeatmapChartSettings,
  settingsComponent: HeatmapSettingsComponent,
  buildTitle: titleFromDescription(DESCRIPTION),
  renderer: HeatmapRenderer,
  createTool: createHeatmapAiTool,
};
