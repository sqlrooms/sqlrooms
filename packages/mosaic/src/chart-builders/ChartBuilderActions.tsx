import {Button, cn} from '@sqlrooms/ui';
import {FC, useCallback, useMemo} from 'react';
import {
  useChartBuilderContext,
  useChartBuilderStore,
} from './ChartBuilderContext';
import {buildChartTypeTitle, canCreateChartFromType} from './chartTypeUtils';
import type {VgPlotChartConfig} from '../chart-types';

export interface ChartBuilderActionsProps {
  className?: string;
}

export const ChartBuilderActions: FC<ChartBuilderActionsProps> = ({
  className,
}) => {
  const {onCreateChart, templates} = useChartBuilderContext();
  const selectedTemplateId = useChartBuilderStore(
    (state) => state.selectedTemplateId,
  );
  const fieldValues = useChartBuilderStore((state) => state.fieldValues);
  const reset = useChartBuilderStore((state) => state.reset);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId),
    [templates, selectedTemplateId],
  );

  const canCreate = canCreateChartFromType(selectedTemplate, fieldValues);

  const handleCreateChart = useCallback(() => {
    if (!selectedTemplate || !canCreate || !selectedTemplateId) {
      return;
    }

    const title = buildChartTypeTitle(selectedTemplate, fieldValues);
    onCreateChart(title, {
      chartType: selectedTemplateId,
      settings: fieldValues,
    } as VgPlotChartConfig);
    reset();
  }, [
    selectedTemplate,
    canCreate,
    selectedTemplateId,
    fieldValues,
    onCreateChart,
    reset,
  ]);

  if (!selectedTemplate) {
    return null;
  }

  return (
    <div className={cn('flex items-center justify-end gap-2', className)}>
      <Button variant="outline" size="sm" onClick={reset}>
        Back
      </Button>
      <Button size="sm" onClick={handleCreateChart} disabled={!canCreate}>
        Create
      </Button>
    </div>
  );
};
