import {Button, cn} from '@sqlrooms/ui';
import {Plus as PlusIcon} from 'lucide-react';
import React from 'react';
import {useStoreWithAi} from '../../AiSlice';
import {DeleteSessionButton} from './DeleteSessionButton';

/**
 * Props for the SessionActions component
 */
export interface SessionActionsProps {
  className?: string;
}

/**
 * Component that displays action buttons for session management.
 * Shows a delete button (via DeleteSessionButton) and a create new session button.
 *
 * @example
 * ```tsx
 * <SessionActions className="my-custom-class" />
 * ```
 */
export const SessionActions: React.FC<SessionActionsProps> = ({className}) => {
  const createSession = useStoreWithAi((s) => s.ai.createSession);

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Delete Current Session Button */}
      <DeleteSessionButton />

      {/* Create New Session Button */}
      <Button
        variant="outline"
        size="sm"
        className="gap-1"
        onClick={() => createSession()}
      >
        <PlusIcon className="h-4 w-4" />
        New Session
      </Button>
    </div>
  );
};
