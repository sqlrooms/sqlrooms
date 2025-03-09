import {Button} from '@sqlrooms/ui';
import {Plus as PlusIcon, Trash2} from 'lucide-react';
import React from 'react';
import {SessionType} from './SessionType';

/**
 * Props for the SessionActions component
 */
export interface SessionActionsProps {
  /** List of available sessions */
  sessions: SessionType[];

  /** ID of the currently active session */
  currentSessionId: string | undefined;

  /** Callback function to create a new session */
  onCreateSession: () => void;

  /** Callback function to open the delete confirmation dialog */
  onOpenDeleteDialog: (sessionId: string) => void;
}

/**
 * Component that displays action buttons for session management.
 * Shows a delete button (only when there's more than one session) and a create new session button.
 *
 * @example
 * ```tsx
 * <SessionActions
 *   sessions={[
 *     { id: "session1", name: "First Analysis" },
 *     { id: "session2", name: "Second Analysis" }
 *   ]}
 *   currentSessionId="session1"
 *   onCreateSession={() => console.log("Create new session")}
 *   onOpenDeleteDialog={(id) => console.log(`Open delete dialog for session ${id}`)}
 * />
 * ```
 */
export const SessionActions: React.FC<SessionActionsProps> = ({
  sessions,
  currentSessionId,
  onCreateSession,
  onOpenDeleteDialog,
}) => {
  return (
    <div className="flex items-center gap-2">
      {/* Delete Current Session Button - Only shown for current session */}
      {sessions.length > 1 && currentSessionId && (
        <Button
          variant="outline"
          size="sm"
          className="text-destructive"
          onClick={() => onOpenDeleteDialog(currentSessionId)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}

      {/* Create New Session Button */}
      <Button
        variant="outline"
        size="sm"
        className="gap-1"
        onClick={onCreateSession}
      >
        <PlusIcon className="h-4 w-4" />
        New Session
      </Button>
    </div>
  );
};
