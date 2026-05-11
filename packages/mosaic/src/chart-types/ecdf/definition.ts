import type {ChartTypeDefinition} from '../base-types';
import type {EcdfChartSettings} from './schema';
import {QUANTITATIVE_COLUMN_TYPES} from '../../chart-builders/constants';
import {titleFromDescription} from '../../chart-builders/chartTypeUtils';
import {EcdfRenderer} from './EcdfRenderer';

const DESCRIPTION = 'Create an eCDF chart of a field';

export const ecdfChartType: ChartTypeDefinition<EcdfChartSettings> = {
  id: 'ecdf',
  label: 'eCDF',
  description: DESCRIPTION,
  aiDescription:
    'Use for a cumulative distribution curve over one numeric or temporal column.',
  fields: [
    {
      key: 'field',
      label: 'Field',
      required: true,
      types: [...QUANTITATIVE_COLUMN_TYPES],
      description:
        'Numeric or temporal column used to build the cumulative distribution.',
    },
  ],
  buildTitle: titleFromDescription(DESCRIPTION),
  renderer: EcdfRenderer,
};
