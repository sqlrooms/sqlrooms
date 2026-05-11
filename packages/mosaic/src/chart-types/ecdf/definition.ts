import type {ChartTypeDefinition} from '../base-types';
import {EcdfChartSettings} from './schema';
import {titleFromDescription} from '../../chart-builders/chartTypeUtils';
import {EcdfSettingsComponent} from './EcdfSettings';
import {createEcdfAiTool} from './tool';
import {createEcdfSpec} from './spec';
import {TrendingUp} from 'lucide-react';

const DESCRIPTION = 'Create an eCDF chart of a field';

export const ecdfChartType: ChartTypeDefinition<EcdfChartSettings> = {
  id: 'ecdf',
  label: 'eCDF',
  description: DESCRIPTION,
  aiDescription:
    'Use for a cumulative distribution curve over one numeric or temporal column.',
  icon: TrendingUp,
  schema: EcdfChartSettings,
  settingsComponent: EcdfSettingsComponent,
  buildTitle: titleFromDescription(DESCRIPTION),
  createTool: createEcdfAiTool,
  createSpec: createEcdfSpec,
};
