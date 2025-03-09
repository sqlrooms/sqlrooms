import {cn, EditableText} from '@sqlrooms/ui';
import React from 'react';
import {useStoreWithAi} from '../../AiSlice';

/**
 * Props for the SessionTitle component
 */
export interface SessionTitleProps {
  className?: string;
}

/**
 * Component that displays the current session name as an editable text field.
 * Shows the model name if available and a placeholder if no session is selected.
 *
 * @example
 * ```tsx
 * <SessionTitle className="my-custom-class" />
 * ```
 */
export const SessionTitle: React.FC<SessionTitleProps> = ({className}) => {
  const currentSession = useStoreWithAi((s) => s.ai.getCurrentSession());
  const renameSession = useStoreWithAi((s) => s.ai.renameSession);

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {currentSession ? (
        <EditableText
          value={currentSession.name}
          onChange={(newName) => {
            if (currentSession && newName.trim()) {
              renameSession(currentSession.id, newName);
            }
          }}
          placeholder="Session name"
          className="text-sm font-medium"
          maxWidth={300}
        />
      ) : (
        <span className="text-muted-foreground text-sm font-medium">
          No session selected
        </span>
      )}
    </div>
  );
};
