import {Button, Spinner} from '@sqlrooms/ui';
import {Play} from 'lucide-react';

import type {SqlCellRunButtonProps} from '../types';

/**
 * Renders the run/cancel control for a SQL cell and shows error feedback.
 */
export function SqlCellRunButton({
  onRun,
  onCancel,
  status,
  runLabel = 'Run',
  disabled,
}: SqlCellRunButtonProps) {
  const showCancel = status?.state === 'running' && Boolean(onCancel);

  return (
    <div className="flex items-center gap-2">
      {showCancel ? (
        <Button
          size="xs"
          variant="destructive"
          className="flex h-7 w-20 gap-1"
          onClick={onCancel}
        >
          <Spinner />
          Cancel
        </Button>
      ) : (
        <Button
          size="xs"
          variant="secondary"
          className="flex h-7 w-20 gap-1"
          onClick={onRun}
          disabled={disabled}
        >
          <Play className="h-3 w-3" />
          {runLabel}
        </Button>
      )}
      {status?.state === 'error' && (
        <span className="text-xs text-red-600">{status.message}</span>
      )}
    </div>
  );
}
