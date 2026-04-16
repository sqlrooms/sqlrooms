import {cn} from '@sqlrooms/ui';
import React, {useMemo} from 'react';
import {
  useChartBuilderContext,
  useChartBuilderStore,
} from './ChartBuilderContext';

export interface ChartBuilderTypeGridProps {
  className?: string;
  showWhenSelected?: boolean;
}

export const ChartBuilderTypeGrid: React.FC<ChartBuilderTypeGridProps> = ({
  className,
  showWhenSelected = false,
}) => {
  const {availableTemplates} = useChartBuilderContext();
  const selectedTemplateId = useChartBuilderStore(
    (state) => state.selectedTemplateId,
  );
  const selectTemplate = useChartBuilderStore((state) => state.selectTemplate);

  const shouldRender = showWhenSelected || !selectedTemplateId;
  const availableCount = availableTemplates.length;
  const selectedTemplate = useMemo(
    () =>
      availableTemplates.find((template) => template.id === selectedTemplateId),
    [availableTemplates, selectedTemplateId],
  );

  if (!shouldRender) return null;

  if (availableCount === 0) {
    return (
      <p className={cn('text-muted-foreground py-4 text-sm', className)}>
        No built-in chart types are available for the current table schema.
      </p>
    );
  }

  return (
    <div className={cn('grid grid-cols-2 gap-2 py-2', className)}>
      {availableTemplates.map((template) => {
        const Icon = template.icon;
        const isSelected = selectedTemplate?.id === template.id;

        return (
          <button
            key={template.id}
            type="button"
            className={cn(
              'flex items-start gap-3 rounded-md border p-3 text-left transition-colors',
              'hover:bg-accent hover:text-accent-foreground',
              isSelected && 'border-primary bg-accent text-accent-foreground',
            )}
            onClick={() => selectTemplate(template.id)}
          >
            <Icon className="mt-0.5 h-5 w-5 shrink-0 opacity-70" />
            <span className="min-w-0">
              <span className="block text-sm font-medium">
                {template.label ?? template.description}
              </span>
              <span className="text-muted-foreground block text-xs">
                {template.description}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
};
