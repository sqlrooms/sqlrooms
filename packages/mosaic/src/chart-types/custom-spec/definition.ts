import type {SpecChartTypeDefinition} from '../base-types';
import {CustomSpecChartConfig, CustomSpecChartSettings} from './schema';
import {titleFromDescription} from '../../chart-builders/chartTypeUtils';
import {CustomSpecSettingsComponent} from './CustomSpecSettings';
import {Code} from 'lucide-react';
import {createCustomSpec} from './spec';

const DESCRIPTION = 'Create a chart with custom spec';

export const customSpecChartType: SpecChartTypeDefinition<CustomSpecChartConfig> =
  {
    id: 'custom-spec',
    label: 'Custom Spec',
    description: DESCRIPTION,
    icon: Code,
    schema: CustomSpecChartSettings,
    settingsComponent: CustomSpecSettingsComponent,
    buildTitle: titleFromDescription(DESCRIPTION),
    createSpec: createCustomSpec,
  };
