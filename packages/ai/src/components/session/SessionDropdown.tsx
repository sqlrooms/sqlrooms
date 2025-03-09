import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@sqlrooms/ui';
import {Check, ChevronDown, History, Plus as PlusIcon} from 'lucide-react';
import React from 'react';
import {SessionType} from './SessionType';

/**
 * Props for the SessionDropdown component
 */
export interface SessionDropdownProps {
  /** List of available sessions */
  sessions: SessionType[];

  /** ID of the currently active session */
  currentSessionId: string | undefined;

  /** Callback function to create a new session */
  onCreateSession: () => void;

  /** Callback function to switch to a different session */
  onSwitchSession: (sessionId: string) => void;
}

/**
 * Dropdown component for managing AI sessions.
 * Allows users to switch between existing sessions or create a new one.
 *
 * @example
 * ```tsx
 * <SessionDropdown
 *   sessions={[
 *     { id: "session1", name: "First Analysis" },
 *     { id: "session2", name: "Second Analysis" }
 *   ]}
 *   currentSessionId="session1"
 *   onCreateSession={() => console.log("Create new session")}
 *   onSwitchSession={(id) => console.log(`Switch to session ${id}`)}
 * />
 * ```
 */
export const SessionDropdown: React.FC<SessionDropdownProps> = ({
  sessions,
  currentSessionId,
  onCreateSession,
  onSwitchSession,
}) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <History className="h-4 w-4" />
          <ChevronDown className="ml-1 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-70">
        <DropdownMenuItem
          onClick={onCreateSession}
          className="flex items-center py-2"
        >
          <PlusIcon className="mr-2 h-4 w-4" />
          New Session
        </DropdownMenuItem>
        <div className="bg-border my-1 h-px" />
        {sessions.map((session) => (
          <DropdownMenuItem
            key={session.id}
            className="flex justify-between py-2"
            onClick={() => onSwitchSession(session.id)}
          >
            <span className="truncate">{session.name}</span>
            {session.id === currentSessionId && (
              <Check className="ml-2 h-4 w-4" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
