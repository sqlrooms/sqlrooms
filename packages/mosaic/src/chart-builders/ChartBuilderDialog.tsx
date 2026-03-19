import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@sqlrooms/ui';
import type {Spec} from '@uwdata/mosaic-spec';
import React from 'react';
import {ChartBuilderContent} from './ChartBuilderContent';
import {ChartBuilderColumn, ChartBuilderTemplate} from './types';

export interface ChartBuilderDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /** Table name to use in generated specs */
  tableName: string;
  /** Available columns for field selectors */
  columns: ChartBuilderColumn[];
  /** Callback when a chart spec is created */
  onCreateChart: (spec: Spec, title: string) => void;
  /** Custom builders (defaults to all built-in builders) */
  builders?: ChartBuilderTemplate[];
}

/**
 * Dialog wrapper for the chart builder.
 * For a non-dialog version, use MosaicChartBuilder.Content directly.
 */
export const ChartBuilderDialog: React.FC<ChartBuilderDialogProps> = ({
  open,
  onOpenChange,
  tableName,
  columns,
  onCreateChart,
  builders,
}) => {
  const handleCreateChart = (spec: Spec, title: string) => {
    onCreateChart(spec, title);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Chart</DialogTitle>
          <DialogDescription>Select a chart type to create.</DialogDescription>
        </DialogHeader>
        <ChartBuilderContent
          tableName={tableName}
          columns={columns}
          onCreateChart={handleCreateChart}
          builders={builders}
        />
      </DialogContent>
    </Dialog>
  );
};
