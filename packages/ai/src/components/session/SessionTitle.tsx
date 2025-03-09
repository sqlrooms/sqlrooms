import {EditableText} from '@sqlrooms/ui';
import React from 'react';
import {SessionType} from './SessionType';

/**
 * Props for the SessionTitle component
 */
export interface SessionTitleProps {
  /** The current active session, or undefined if no session is selected */
  currentSession: SessionType | undefined;

  /** Callback function to rename a session */
  onRenameSession: (sessionId: string, newName: string) => void;
}

/**
 * Component that displays the current session name as an editable text field.
 * Shows the model name if available and a placeholder if no session is selected.
 *
 * @example
 * ```tsx
 * <SessionTitle
 *   currentSession={{
 *     id: "session123",
 *     name: "My Analysis Session",
 *     model: "gpt-4o-mini"
 *   }}
 *   onRenameSession={(id, newName) => console.log(`Rename session ${id} to ${newName}`)}
 * />
 * ```
 */
export const SessionTitle: React.FC<SessionTitleProps> = ({
  currentSession,
  onRenameSession,
}) => {
  return (
    <div className="flex items-center gap-2">
      {currentSession ? (
        <>
          <EditableText
            value={currentSession.name}
            onChange={(newName) => {
              if (currentSession && newName.trim()) {
                onRenameSession(currentSession.id, newName);
              }
            }}
            placeholder="Session name"
            className="text-sm font-medium"
            maxWidth={300}
          />
          <div className="text-muted-foreground text-xs">
            {currentSession.model}
          </div>
        </>
      ) : (
        <span className="text-muted-foreground text-sm font-medium">
          No session selected
        </span>
      )}
    </div>
  );
};
