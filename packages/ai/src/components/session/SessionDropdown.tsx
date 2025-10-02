import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@sqlrooms/ui';
import {Check, ChevronDown, History, Plus as PlusIcon} from 'lucide-react';
import React from 'react';
import {useStoreWithAi} from '../../AiSlice';

/**
 * Props for the SessionDropdown component
 */
export interface SessionDropdownProps {
  className?: string;
}

/**
 * Dropdown component for managing AI sessions.
 * Allows users to switch between existing sessions or create a new one.
 *
 * @example
 * ```tsx
 * <SessionDropdown className="my-custom-class" />
 * ```
 */
export const SessionDropdown: React.FC<SessionDropdownProps> = ({
  className,
}) => {
  const sessions = useStoreWithAi((s) => s.ai.config.sessions);
  const currentSessionId = useStoreWithAi((s) => s.ai.config.currentSessionId);
  const switchSession = useStoreWithAi((s) => s.ai.switchSession);
  const createSession = useStoreWithAi((s) => s.ai.createSession);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className={cn('gap-1', className)} variant="outline" size="sm">
          <History className="h-4 w-4" />
          <ChevronDown className="ml-1 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-70">
        <DropdownMenuItem
          onClick={() => createSession()}
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
            onClick={() => switchSession(session.id)}
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
