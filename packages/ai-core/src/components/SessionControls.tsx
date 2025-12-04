import {cn, TabStrip} from '@sqlrooms/ui';
import {HistoryIcon, PencilIcon, TrashIcon} from 'lucide-react';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {useStoreWithAi} from '../AiSlice';
import {DeleteSessionDialog} from './session';

/**
 * Main component for managing AI sessions.
 * Uses TabStrip for session management with dropdown for switching sessions.
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
  const sessions = useStoreWithAi((s) => s.ai.config.sessions);
  const currentSessionId = useStoreWithAi((s) => s.ai.config.currentSessionId);
  const currentSession = useStoreWithAi((s) => s.ai.getCurrentSession());
  const switchSession = useStoreWithAi((s) => s.ai.switchSession);
  const createSession = useStoreWithAi((s) => s.ai.createSession);
  const renameSession = useStoreWithAi((s) => s.ai.renameSession);
  const deleteSession = useStoreWithAi((s) => s.ai.deleteSession);

  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [openTabIds, setOpenTabIds] = useState<string[]>(() =>
    currentSessionId ? [currentSessionId] : [],
  );

  // Ensure current session is always in open tabs
  useEffect(() => {
    if (currentSessionId && !openTabIds.includes(currentSessionId)) {
      setOpenTabIds((prev) => [...prev, currentSessionId]);
    }
  }, [currentSessionId, openTabIds]);

  // Remove deleted sessions from open tabs
  useEffect(() => {
    const sessionIds = new Set(sessions.map((s) => s.id));
    setOpenTabIds((prev) => prev.filter((id) => sessionIds.has(id)));
  }, [sessions]);

  // Convert sessions to TabDescriptor format
  const tabs = useMemo(
    () => sessions.map((s) => ({id: s.id, name: s.name})),
    [sessions],
  );

  const handleClose = useCallback(
    (sessionId: string) => {
      // Don't close if it's the only open tab
      if (openTabIds.length <= 1) return;

      setOpenTabIds((prev) => prev.filter((id) => id !== sessionId));

      // If closing the current session, switch to another open one
      if (sessionId === currentSessionId) {
        const remaining = openTabIds.filter((id) => id !== sessionId);
        if (remaining.length > 0) {
          switchSession(remaining[0]!);
        }
      }
    },
    [openTabIds, currentSessionId, switchSession],
  );

  const handleDelete = useCallback(
    (sessionId: string) => {
      const session = sessions.find((s) => s.id === sessionId);
      // If session is empty (no messages), delete without confirmation
      if (!session?.uiMessages?.length) {
        deleteSession(sessionId);
      } else {
        setSessionToDelete(sessionId);
      }
    },
    [sessions, deleteSession],
  );

  const handleConfirmDelete = useCallback(() => {
    if (sessionToDelete) {
      deleteSession(sessionToDelete);
      setSessionToDelete(null);
    }
  }, [sessionToDelete, deleteSession]);

  const handleCloseDeleteDialog = useCallback(() => {
    setSessionToDelete(null);
  }, []);

  return (
    <>
      <div
        className={cn(
          'flex w-full flex-wrap items-center justify-between gap-2 overflow-hidden',
          className,
        )}
      >
        <div className="flex w-full min-w-0 items-center gap-3">
          <TabStrip
            tabs={tabs}
            openTabIds={openTabIds}
            selectedTabId={currentSessionId}
            onClose={handleClose}
            onOpenTabsChange={setOpenTabIds}
            onSelect={switchSession}
            onCreate={() => createSession()}
            onRename={renameSession}
            renderTabMenu={(tab) => (
              <>
                <TabStrip.MenuItem
                  onClick={() =>
                    renameSession(
                      tab.id,
                      prompt('New name:', tab.name) || tab.name,
                    )
                  }
                >
                  <PencilIcon className="mr-2 h-4 w-4" />
                  Rename
                </TabStrip.MenuItem>
                {sessions.length > 1 && (
                  <>
                    <TabStrip.MenuSeparator />
                    <TabStrip.MenuItem
                      variant="destructive"
                      onClick={() => handleDelete(tab.id)}
                    >
                      <TrashIcon className="mr-2 h-4 w-4" />
                      Delete
                    </TabStrip.MenuItem>
                  </>
                )}
              </>
            )}
            renderSearchItemActions={(tab) => (
              <>
                {sessions.length > 1 && (
                  <TabStrip.SearchItemAction
                    icon={<TrashIcon className="h-3 w-3" />}
                    aria-label={`Delete ${tab.name}`}
                    onClick={() => handleDelete(tab.id)}
                  />
                )}
              </>
            )}
          >
            <TabStrip.SearchDropdown
              triggerIcon={<HistoryIcon className="h-4 w-4" />}
              tooltip="Session history"
            />
            <TabStrip.Tabs />
            <TabStrip.NewButton tooltip="New session" />
          </TabStrip>
          {currentSession && (
            <div className="text-muted-foreground whitespace-nowrap text-xs">
              {currentSession.model}
            </div>
          )}
        </div>

        {children}
      </div>

      <DeleteSessionDialog
        isOpen={sessionToDelete !== null}
        onClose={handleCloseDeleteDialog}
        onDelete={handleConfirmDelete}
      />
    </>
  );
};
