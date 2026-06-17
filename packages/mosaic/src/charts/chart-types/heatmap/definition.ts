import type {SpecChartTypeDefinition} from '../base-types';
import {HeatmapChartConfig, HeatmapChartSettings} from './schema';
import {titleFromDescription} from '../../../chart-builders/chartTypeUtils';
import {HeatmapSettingsComponent} from './HeatmapSettings';
import {createHeatmapAiTool} from './tool';
import {Grid3X3} from 'lucide-react';
import {createHeatmapSpec} from './spec';

const DESCRIPTION = 'Create a 2D heatmap of two fields';

export const heatmapChartType: SpecChartTypeDefinition<HeatmapChartConfig> = {
  id: 'heatmap',
  label: 'Heatmap',
  description: DESCRIPTION,
  icon: Grid3X3,
  schema: HeatmapChartSettings,
  settingsComponent: HeatmapSettingsComponent,
  buildTitle: titleFromDescription(DESCRIPTION),
  createTool: createHeatmapAiTool,
  createSpec: createHeatmapSpec,
};
