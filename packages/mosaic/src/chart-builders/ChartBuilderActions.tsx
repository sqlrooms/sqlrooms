import {Button, cn} from '@sqlrooms/ui';
import React, {useMemo} from 'react';
import {
  useChartBuilderContext,
  useChartBuilderStore,
} from './ChartBuilderContext';
import {buildChartTypeTitle, canCreateChartFromType} from './chartTypeUtils';

export interface ChartBuilderActionsProps {
  className?: string;
}

export const ChartBuilderActions: React.FC<ChartBuilderActionsProps> = ({
  className,
}) => {
  const {columns, onCreateChart, onCreateChartOutput, tableName, templates} =
    useChartBuilderContext();
  const selectedTemplateId = useChartBuilderStore(
    (state) => state.selectedTemplateId,
  );
  const fieldValues = useChartBuilderStore((state) => state.fieldValues);
  const reset = useChartBuilderStore((state) => state.reset);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId),
    [templates, selectedTemplateId],
  );

  const canCreate = canCreateChartFromType(
    selectedTemplate,
    fieldValues,
    columns,
  );

  if (!selectedTemplate) return null;

  return (
    <div className={cn('flex items-center justify-end gap-2', className)}>
      <Button variant="outline" size="sm" onClick={reset}>
        Back
      </Button>
      <Button
        size="sm"
        onClick={() => {
          if (!selectedTemplate || !canCreate || !selectedTemplateId) return;
          const title = buildChartTypeTitle(selectedTemplate, fieldValues);

          // Check if this chart type creates a custom dashboard panel (e.g. box-plot)
          if (selectedTemplate.createOutput && onCreateChartOutput) {
            onCreateChartOutput(
              selectedTemplate.createOutput(tableName, fieldValues),
              title,
            );
          } else {
            // Use renderer pattern: create vgplot panel with chartType and settings
            // The dashboard will use the chart type's renderer to render it
            onCreateChart(title, {
              chartType: selectedTemplateId,
              settings: fieldValues,
              vgplot: null,
            });
          }
          reset();
        }}
        disabled={!canCreate}
      >
        Create
      </Button>
    </div>
  );
};
