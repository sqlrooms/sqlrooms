import {Button, cn} from '@sqlrooms/ui';
import {Check, RotateCcw, X} from 'lucide-react';
import React from 'react';
import {useMosaicEditorContext} from './MosaicEditorContext';

export interface MosaicChartEditorActionsProps {
  /**
   * Custom class name for the actions container
   */
  className?: string;
  /**
   * Whether to show the Reset button
   * @default true
   */
  showReset?: boolean;
}

/**
 * Actions subcomponent for MosaicChart.Container.
 * Renders Apply, Cancel, and Reset buttons.
 *
 * Must be used within a MosaicChart.Container component.
 */
export const MosaicChartEditorActions: React.FC<
  MosaicChartEditorActionsProps
> = ({className, showReset = true}) => {
  const {actions, canApply, hasChanges, editable} = useMosaicEditorContext();

  if (!editable) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex items-center justify-end gap-2 border-t px-3 py-2',
        className,
      )}
    >
      {showReset && (
        <Button
          variant="ghost"
          size="sm"
          onClick={actions.resetToOriginal}
          title="Reset to original"
        >
          <RotateCcw className="mr-1 h-4 w-4" />
          Reset
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={actions.cancelChanges}
        disabled={!hasChanges}
      >
        <X className="mr-1 h-4 w-4" />
        Cancel
      </Button>
      <Button
        variant="default"
        size="sm"
        onClick={actions.applyChanges}
        disabled={!canApply}
      >
        <Check className="mr-1 h-4 w-4" />
        Apply
      </Button>
    </div>
  );
};
