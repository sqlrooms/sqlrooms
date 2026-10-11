import {RunButton, type RunButtonProps} from '@sqlrooms/ui';
import {SqlCellRunStatus} from '../types';

type SqlCellRunButtonProps = {
  onRun: () => void;
  onCancel?: () => void;
  status?: SqlCellRunStatus;
  runLabel?: string;
  disabled?: boolean;
} & Pick<RunButtonProps, 'variant' | 'cancelVariant' | 'className'>;

/**
 * Renders the run/cancel control for a SQL cell.
 * Thin wrapper that maps {@link SqlCellRunStatus} to {@link RunQueryButton} state.
 */
export function SqlCellRunButton({
  onRun,
  onCancel,
  status,
  runLabel,
  disabled,
  ...rest
}: SqlCellRunButtonProps) {
  const state =
    status?.state === 'running'
      ? 'running'
      : status?.state === 'cancel'
        ? 'cancelling'
        : 'idle';

  return (
    <RunButton
      state={state}
      onRun={onRun}
      onCancel={onCancel}
      runLabel={runLabel}
      disabled={disabled}
      {...rest}
    />
  );
}
