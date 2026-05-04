import {useCallback} from 'react';
import type {ChartBuilderField} from '../types';

interface UseChartFieldFormProps {
  fields: ChartBuilderField[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}

export function useChartFieldForm({
  fields,
  values,
  onChange,
}: UseChartFieldFormProps) {
  const handleFieldChange = useCallback(
    (fieldKey: string, value: unknown) => {
      onChange(fieldKey, value);
    },
    [onChange],
  );

  return {
    fields,
    values,
    handleFieldChange,
  };
}
