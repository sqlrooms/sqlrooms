import type {SpecChartTypeDefinition} from '../base-types';
import {CustomSpecChartConfig, CustomSpecChartSettings} from './schema';
import {titleFromDescription} from '../../chart-builders/chartTypeUtils';
import {CustomSpecSettingsComponent} from './CustomSpecSettings';
import {Code} from 'lucide-react';
import {createCustomSpec} from './spec';
import {CUSTOM_SPEC_DESCRIPTION} from './constants';

export const customSpecChartType: SpecChartTypeDefinition<CustomSpecChartConfig> =
  {
    id: 'custom-spec',
    label: 'Custom Spec',
    description: CUSTOM_SPEC_DESCRIPTION,
    icon: Code,
    schema: CustomSpecChartSettings,
    settingsComponent: CustomSpecSettingsComponent,
    buildTitle: titleFromDescription(CUSTOM_SPEC_DESCRIPTION),
    createSpec: createCustomSpec,
  };
