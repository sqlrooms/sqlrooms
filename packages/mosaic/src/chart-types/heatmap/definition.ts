import type {SpecChartTypeDefinition} from '../base-types';
import {HeatmapChartConfig, HeatmapChartSettings} from './schema';
import {titleFromDescription} from '../../chart-builders/chartTypeUtils';
import {HeatmapSettingsComponent} from './HeatmapSettings';
import {createHeatmapAiTool} from './tool';
import {Grid3X3} from 'lucide-react';
import {createHeatmapSpec} from './spec';
import {MAX_HEATMAP_DATA_POINTS, HEATMAP_DESCRIPTION} from './constants';

export const heatmapChartType: SpecChartTypeDefinition<HeatmapChartConfig> = {
  id: 'heatmap',
  label: 'Heatmap',
  description: HEATMAP_DESCRIPTION,
  icon: Grid3X3,
  schema: HeatmapChartSettings,
  settingsComponent: HeatmapSettingsComponent,
  buildTitle: titleFromDescription(HEATMAP_DESCRIPTION),
  createTool: createHeatmapAiTool,
  createSpec: createHeatmapSpec,
  maxDataPoints: MAX_HEATMAP_DATA_POINTS,
};
