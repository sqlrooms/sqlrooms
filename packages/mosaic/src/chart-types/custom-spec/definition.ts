import type {ChartTypeDefinition} from '../base-types';
import type {CustomSpecChartSettings} from './schema';
import {titleFromDescription} from '../../chart-builders/chartTypeUtils';
import {CustomSpecRenderer} from './CustomSpecRenderer';

const DESCRIPTION = 'Create a chart with custom spec';

export const customSpecChartType: ChartTypeDefinition<CustomSpecChartSettings> =
  {
    id: 'custom-spec',
    label: 'Custom Spec',
    description: DESCRIPTION,
    aiDescription:
      'Manual template for editing after creation. Prefer explicit chart templates for assistant-created charts.',
    fields: [],
    buildTitle: titleFromDescription(DESCRIPTION),
    renderer: CustomSpecRenderer,
  };
