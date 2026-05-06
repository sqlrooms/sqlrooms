import type {FC} from 'react';
import type {ChartBuilderColumn} from '../../chart-builders/types';
import type {CustomSpecChartSettings} from './schema';

export interface CustomSpecSettingsComponentProps {
  columns: ChartBuilderColumn[];
  values: CustomSpecChartSettings;
  onChange: (values: CustomSpecChartSettings) => void;
}

/**
 * Settings component for custom spec chart type.
 * Custom spec has no configurable fields - it's meant to be edited manually.
 */
export const CustomSpecSettingsComponent: FC<
  CustomSpecSettingsComponentProps
> = () => {
  return (
    <div className="text-muted-foreground py-2 text-sm">
      This chart type has no configurable fields. A starter spec will be created
      that you can edit manually.
    </div>
  );
};
