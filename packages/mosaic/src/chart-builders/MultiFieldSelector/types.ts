import type {ChartBuilderColumn} from '../types';
import type {YFieldConfig} from '../../chart-types/line-chart/schema';

export interface MultiFieldSelectorProps {
  label: string;
  required?: boolean;
  columns: ChartBuilderColumn[];
  types?: string[];
  value: YFieldConfig[];
  onChange: (value: YFieldConfig[]) => void;
  showAggregation?: boolean;
}
