import {FC} from 'react';
import {Play} from 'lucide-react';
import {Button, type ButtonProps} from './button';
import {Spinner} from './spinner';
import {cn} from '../lib/utils';

type RunButtonState = 'idle' | 'running' | 'cancelling';

export type RunButtonProps = {
  state?: RunButtonState;
  onRun: () => void;
  onCancel?: () => void;
  runLabel?: string;
  disabled?: boolean;
  variant?: ButtonProps['variant'];
  cancelVariant?: ButtonProps['variant'];
  className?: string;
};

/**
 * A fixed-width run/cancel button that doesn't shift layout between states.
 */
export const RunButton: FC<RunButtonProps> = ({
  state = 'idle',
  onRun,
  onCancel,
  runLabel = 'Run',
  disabled,
  variant = 'secondary',
  cancelVariant = 'destructive',
  className,
}) => {
  const isRunning = state === 'running';
  const isCancelling = state === 'cancelling';

  if (isRunning || isCancelling) {
    return (
      <Button
        size="xs"
        variant={cancelVariant}
        className={cn('flex h-7 w-20 gap-1', className)}
        onClick={onCancel}
        disabled={isCancelling || !onCancel}
      >
        <Spinner className="h-3.5 w-3.5 text-current" />
        {isCancelling ? 'Stopping' : 'Cancel'}
      </Button>
    );
  }

  return (
    <Button
      size="xs"
      variant={variant}
      className={cn('flex h-7 w-20 gap-1', className)}
      onClick={onRun}
      disabled={disabled}
    >
      <Play className="h-3 w-3" />
      {runLabel}
    </Button>
  );
};
