import type {ChartTypeDefinition} from '../base-types';
import {CustomSpecChartConfig, CustomSpecChartSettings} from './schema';
import {titleFromDescription} from '../../chart-builders/chartTypeUtils';
import {CustomSpecRenderer} from './CustomSpecRenderer';
import {CustomSpecSettingsComponent} from './CustomSpecSettings';
import {Code} from 'lucide-react';

const DESCRIPTION = 'Create a chart with custom spec';

export const customSpecChartType: ChartTypeDefinition<CustomSpecChartConfig> = {
  id: 'custom-spec',
  label: 'Custom Spec',
  description: DESCRIPTION,
  aiDescription:
    'Manual template for editing after creation. Prefer explicit chart templates for assistant-created charts.',
  icon: Code,
  schema: CustomSpecChartSettings,
  settingsComponent: CustomSpecSettingsComponent,
  buildTitle: titleFromDescription(DESCRIPTION),
  renderer: CustomSpecRenderer,
};
