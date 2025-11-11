import {cn} from '@sqlrooms/ui';
import React from 'react';
import {useStoreWithAi} from '../AiSlice';
import {SessionActions, SessionDropdown, SessionTitle} from './session';

/**
 * Main component for managing AI sessions.
 * Combines session dropdown, title editing, action buttons, and delete confirmation.
 *
 * @example
 * ```tsx
 * <SessionControls className="p-4 border-b">
 *   <Button>Custom Button</Button>
 * </SessionControls>
 * ```
 */
export const SessionControls: React.FC<{
  className?: string;
  children?: React.ReactNode;
}> = ({className, children}) => {
  const currentSession = useStoreWithAi((s) => s.ai.getCurrentSession());
  return (
    <>
      {/* Header with session controls */}
      <div
        className={cn('flex flex-wrap items-center justify-between', className)}
      >
        {/* Left side - History Button and Editable Session Title */}
        <div className="flex items-center gap-3">
          <SessionDropdown />
          <SessionTitle />

        </div>

        {/* Render children if provided */}
        {children}

        {/* Right side buttons */}
        <SessionActions />
      </div>
    </>
  );
};
